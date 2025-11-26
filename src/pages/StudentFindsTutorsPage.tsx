import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";

import "../styles/StudentDashboard.css";
import "../styles/Calendar.css";

import { useAuthFlow } from "../utils/useAuthFlow";
import { useProfileStatus } from "../utils/useProfileStatus";
import ApiSearchService from "../service/Api-search";
import ProfileIncompleteNotification from "../components/ProfileIncompleteNotification";
import { AppHeader, type ActiveSection } from "./StudentDashboard";
import { studentMenuNavigate } from "../utils/StudentMenu";
import ApiPaymentService from "../service/Api-payment";

// leer reservas del estudiante
import { getMyReservations } from "../service/Api-scheduler";

interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  educationLevel?: string;
}

interface TutorCard {
  userId: string;
  name: string;
  email: string;
  bio?: string;
  specializations?: string[];
  credentials?: string[];
  rating?: number;
  tokensPerHour?: number;
}

const TUTORS_PER_PAGE = 10;

const StudentFindsTutorsPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { userRoles, isAuthenticated, needsRoleSelection } = useAuthFlow();
  const { isProfileComplete, missingFields } = useProfileStatus();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [tutors, setTutors] = useState<TutorCard[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [errorSearch, setErrorSearch] = useState<string>("");

  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  // tutorId -> número de reservas del estudiante con ese tutor
  const [reservationsByTutorId, setReservationsByTutorId] =
    useState<Record<string, number>>({});

  // paginación
  const [currentPage, setCurrentPage] = useState<number>(1);

  // para no disparar la carga inicial más de una vez
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // último query que realmente se usó para buscar en backend
  const [lastQuery, setLastQuery] = useState<string>("");

  // ==============================
  // Auth / usuario actual
  // ==============================
  useEffect(() => {
    if (isAuthenticated === null || userRoles === null) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (needsRoleSelection) {
      navigate("/role-selection");
      return;
    }
    if (!userRoles?.includes("student")) {
      navigate("/");
      return;
    }

    if (auth.user) {
      setCurrentUser({
        userId: auth.user.profile?.sub || "unknown",
        name: auth.user.profile?.name || auth.user.profile?.nickname || "Usuario",
        email: auth.user.profile?.email || "No email",
        role: "student",
      });
    }
  }, [isAuthenticated, userRoles, needsRoleSelection, navigate, auth.user]);

  // ==============================
  // Balance de tokens (ignora warnings si backend no está arriba)
  // ==============================
  useEffect(() => {
    const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
    if (!token) return;

    const loadBalance = async () => {
      try {
        const data = await ApiPaymentService.getStudentBalance(token);
        setTokenBalance(data.tokenBalance);
      } catch (e) {
        console.error("Error cargando balance:", e);
      }
    };
    loadBalance();
  }, [auth.user]);

  // ==============================
  // Estadísticas de reservas por tutor
  // ==============================
  useEffect(() => {
    const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
    if (!token || !currentUser) return;

    const toISODate = (d: Date) => d.toISOString().slice(0, 10);

    const loadReservationsStats = async () => {
      try {
        const today = new Date();
        const past = new Date(today);
        const future = new Date(today);
        past.setFullYear(today.getFullYear() - 1);
        future.setFullYear(today.getFullYear() + 1);

        const from = toISODate(past);
        const to = toISODate(future);

        const data = await getMyReservations(from, to, token);
        const stats: Record<string, number> = {};

        (data as any[]).forEach((r) => {
          const tutorId = r?.tutorId;
          if (!tutorId) return;
          stats[tutorId] = (stats[tutorId] ?? 0) + 1;
        });

        setReservationsByTutorId(stats);
      } catch (e) {
        console.error("Error cargando reservas para ranking de tutores:", e);
        setReservationsByTutorId({});
      }
    };

    loadReservationsStats();
  }, [auth.user, currentUser]);

  // ==============================
  // Búsqueda de tutores
  // ==============================
  const performSearch = useCallback(async (query: string) => {
    setLoadingSearch(true);
    setErrorSearch("");
    try {
      const q = query ?? "";
      const result = await ApiSearchService.searchTutors(q);
      setTutors(result || []);
      setLastQuery(q); // guardamos el query usado
      sessionStorage.setItem(
        "u-learn:lastTutorSearchCount",
        String(result?.length ?? 0)
      );
      setCurrentPage(1);
    } catch (err: any) {
      setErrorSearch(err?.message || "Error en la búsqueda");
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  const handleSearchTutors = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await performSearch(searchQuery);
  };

  // búsqueda automática al abrir (query vacío)
  useEffect(() => {
    if (!currentUser) return;
    if (hasAutoLoaded) return;

    performSearch("");
    setHasAutoLoaded(true);
  }, [currentUser, hasAutoLoaded, performSearch]);

  const onHeaderSectionChange = (section: ActiveSection) => {
    studentMenuNavigate(navigate, section as any);
  };

  // ==============================
  // Ordenar tutores según reglas
  // ==============================
  const sortedTutors = useMemo(() => {
    if (!tutors || tutors.length === 0) return [];

    // Si el último query usado NO está vacío, respetamos el orden que decidió el backend
    if (lastQuery.trim().length > 0) {
      return tutors;
    }

    // Lista "por defecto" (query vacío): ordenar por reservas, luego credenciales, luego especializaciones, rating,
    // y si empata todo, por nombre DESC para "invertir el orden"
    const hasReservationWithAnyTutor = tutors.some(
      (t) => (reservationsByTutorId[t.userId] ?? 0) > 0
    );

    const arr = [...tutors];

    arr.sort((a, b) => {
      const countA = reservationsByTutorId[a.userId] ?? 0;
      const countB = reservationsByTutorId[b.userId] ?? 0;

      const credA = a.credentials?.length ?? 0;
      const credB = b.credentials?.length ?? 0;
      const specA = a.specializations?.length ?? 0;
      const specB = b.specializations?.length ?? 0;
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;

      if (hasReservationWithAnyTutor) {
        // 1) más reservas
        if (countB !== countA) return countB - countA;
        // desempates
        if (credB !== credA) return credB - credA;
        if (specB !== specA) return specB - specA;
        if (ratingB !== ratingA) return ratingB - ratingA;
        // aquí invertimos el orden por nombre (DESC)
        return b.name.localeCompare(a.name);
      } else {
        // sin reservas: credenciales, especializaciones, rating
        if (credB !== credA) return credB - credA;
        if (specB !== specA) return specB - specA;
        if (ratingB !== ratingA) return ratingB - ratingA;
        // nombre DESC para que se invierta el orden
        return b.name.localeCompare(a.name);
      }
    });

    return arr;
  }, [tutors, reservationsByTutorId, lastQuery]);

  // ==============================
  // Paginación (máx 10 por página)
  // ==============================
  const totalPages = Math.max(
    1,
    Math.ceil(sortedTutors.length / TUTORS_PER_PAGE)
  );

  const paginatedTutors = useMemo(() => {
    const start = (currentPage - 1) * TUTORS_PER_PAGE;
    const end = start + TUTORS_PER_PAGE;
    return sortedTutors.slice(start, end);
  }, [sortedTutors, currentPage]);

  if (auth.isLoading || !currentUser) {
    return <div className="full-center">Cargando...</div>;
  }

  return (
    <div className="dashboard-container">
      {!isProfileComplete && missingFields && showProfileBanner && (
        <ProfileIncompleteNotification
          currentRole="student"
          missingFields={missingFields}
          onDismiss={() => setShowProfileBanner(false)}
        />
      )}

      <AppHeader
        currentUser={currentUser}
        activeSection={"find-tutors"}
        onSectionChange={onHeaderSectionChange}
        tokenBalance={tokenBalance}
      />

      <main className="dashboard-main">
        <div className="tutors-section">
          <h1>Buscar Tutores 🔍</h1>

          <section className="tutor-search">
            <form onSubmit={handleSearchTutors} className="tutor-search-form">
              <input
                type="text"
                placeholder="Ej: java, cálculo, María..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" disabled={loadingSearch}>
                {loadingSearch ? "Buscando..." : "Buscar"}
              </button>
            </form>

            {errorSearch && <p className="error">{errorSearch}</p>}

            <div className="tutor-results">
              {sortedTutors.length === 0 && !loadingSearch && (
                <p>No hay resultados. Prueba con “java”.</p>
              )}

              {paginatedTutors.map((tutor, idx) => (
                <div
                  key={tutor.userId || `tutor-${idx}`}
                  className="tutor-card"
                >
                  <div className="tutor-card-header">
                    <div className="tutor-title">
                      <strong className="tutor-name">{tutor.name}</strong>
                      <br />
                      <span className="tutor-email">{tutor.email}</span>
                    </div>
                  </div>

                  {tutor.bio && <p className="tutor-bio">{tutor.bio}</p>}

                  {tutor.specializations && tutor.specializations.length > 0 && (
                    <div className="tutor-tags">
                      {tutor.specializations.map((s, tagIdx) => (
                        <span
                          key={`${tutor.userId || "tutor"}-spec-${tagIdx}`}
                          className="tag"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {typeof tutor.tokensPerHour === "number" &&
                    tutor.tokensPerHour > 0 && (
                      <p className="tutor-rate">
                        <strong>Tarifa:</strong>{" "}
                        {tutor.tokensPerHour} tokens/hora
                      </p>
                    )}

                  <div className="tutor-actions">
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        navigate(`/profile/tutor/${tutor.userId}`, {
                          state: { profile: tutor },
                        })
                      }
                      type="button"
                    >
                      Ver Perfil
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() =>
                        navigate(`/book/${tutor.userId}`, {
                          state: { tutor, role: "tutor" },
                        })
                      }
                      type="button"
                    >
                      Reservar Cita
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {sortedTutors.length > TUTORS_PER_PAGE && (
              <div
                className="pagination-controls"
                style={{ marginTop: "20px", textAlign: "center" }}
              >
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>

                <span
                  style={{
                    margin: "0 15px",
                    fontWeight: "bold",
                  }}
                >
                  Página {currentPage} de {totalPages}
                </span>

                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default StudentFindsTutorsPage;
