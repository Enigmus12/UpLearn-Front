import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import isoWeek from "dayjs/plugin/isoWeek";

import "../styles/StudentDashboard.css";   // header
import "../styles/ReservationPage.css";    // grilla

import DashboardSwitchButton from "../components/DashboardSwitchButton";
import AddRoleButton from "../components/AddRoleButton";

import {
  fetchWeekAvailability,
  createReservation,
} from "../service/Api-reservations";

// --- tutor name cache (localStorage) ---
const TUTOR_NAME_MAP_KEY = "uplearn:tutorNameMap";

function loadTutorNameMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(TUTOR_NAME_MAP_KEY) || "{}"); }
  catch { return {}; }
}
function saveTutorName(tutorId: string, tutorName?: string) {
  if (!tutorId || !tutorName) return;
  const m = loadTutorNameMap();
  if (m[tutorId] !== tutorName) {
    m[tutorId] = tutorName;
    localStorage.setItem(TUTOR_NAME_MAP_KEY, JSON.stringify(m));
  }
}

dayjs.extend(localizedFormat);
dayjs.extend(isoWeek);

type Slot = { start: string; end: string; available: boolean };
type GridDay = { day: string; slots: Slot[] };

const SLOT_MINUTES = 60;
const DAY_START = "08:00";
const DAY_END = "20:00";

export default function ReservationPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ tutorId?: string }>();
  const location = useLocation() as { state?: { tutorId?: string; tutorName?: string } };

  const idToken = auth.user?.access_token ?? "";
  const currentUserName =
    auth.user?.profile?.name || auth.user?.profile?.nickname || "Usuario";

  // Tutor id únicamente desde state o ruta
  const resolvedTutorId =
    location.state?.tutorId ??
    (params.tutorId && params.tutorId !== "undefined" ? params.tutorId : "");

  // Guarda el nombre apenas entras (por si venía en state)
  useEffect(() => {
    if (resolvedTutorId && location.state?.tutorName) {
      saveTutorName(resolvedTutorId, location.state.tutorName);
    }
  }, [resolvedTutorId, location.state?.tutorName]);

  // Semana actual: lunes
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week").add(1, "day"));
  const weekStartISO = useMemo(() => weekStart.format("YYYY-MM-DD"), [weekStart]);

  const [grid, setGrid] = useState<GridDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar disponibilidad automáticamente
  useEffect(() => {
    if (!resolvedTutorId) {
      alert("No se recibió tutorId. Volviendo a Buscar Tutores…");
      navigate("/student-dashboard", { state: { section: "find-tutors" } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWeekAvailability(
          resolvedTutorId,
          weekStartISO,
          SLOT_MINUTES,
          DAY_START,
          DAY_END
        );
        const days = Object.keys(data).sort((a, b) => a.localeCompare(b));
        const asGrid: GridDay[] = days.map((d) => ({
          day: d,
          slots: data[d] as Slot[],
        }));
        setGrid(asGrid);
      } catch (e: any) {
        setError(e?.message || "No fue posible cargar disponibilidad");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [resolvedTutorId, weekStartISO, navigate]);

  // Navegación temporal
  const nextWeek = () => {
    const next = weekStart.add(1, "week");
    if (next.isAfter(dayjs().add(3, "month"))) return;
    setWeekStart(next);
  };
  const prevWeek = () => setWeekStart(weekStart.subtract(1, "week"));
  const nextMonth = () => {
    const next = weekStart.add(1, "month");
    if (next.isAfter(dayjs().add(3, "month"))) return;
    setWeekStart(next);
  };
  const prevMonth = () => setWeekStart(weekStart.subtract(1, "month"));
  const goToday = () => setWeekStart(dayjs().startOf("week").add(1, "day"));

  // Reservar
  const book = async (day: string, start: string, end: string) => {
    if (!auth.user) return alert("Debes iniciar sesión");
    try {
      const sub = auth.user?.profile?.sub ?? "";
      await createReservation({ tutorId: resolvedTutorId!, day, start, end }, idToken, sub);

      // guarda nombre del tutor para el dashboard
      saveTutorName(resolvedTutorId!, location.state?.tutorName);

      alert("Reserva creada correctamente");
      // recargar
      const data = await fetchWeekAvailability(
        resolvedTutorId!,
        weekStartISO,
        SLOT_MINUTES,
        DAY_START,
        DAY_END
      );
      const days = Object.keys(data).sort((a, b) => a.localeCompare(b));
      const asGrid: GridDay[] = days.map((d) => ({
        day: d,
        slots: data[d] as Slot[],
      }));
      setGrid(asGrid);
    } catch (e: any) {
      alert(e?.message || "No fue posible crear la reserva");
    }
  };

  const hasGrid = grid.length > 0 && grid[0]?.slots?.length > 0;

  return (
    <div className="res-page">
      {/* Header (mismo que StudentDashboard) */}
      <header className="dashboard-header res-dashboard-header">
        <div className="header-content">
          <div className="logo">
            <h2>UpLearn Student</h2>
          </div>

          <nav className="main-nav">
            <button className="nav-item" onClick={() => navigate("/student-dashboard")}>
              <span>📊</span> Dashboard
            </button>
            <button className="nav-item" onClick={() => navigate("/student-dashboard", { state: { section: "find-tutors" } })}>
              <span>🔍</span> Buscar Tutores
            </button>
            <button className="nav-item" onClick={() => navigate("/student-dashboard", { state: { section: "my-tasks" } })}>
              <span>📋</span> Mis Tareas
            </button>
            <button className="nav-item" onClick={() => navigate("/student-dashboard", { state: { section: "post-task" } })}>
              <span>➕</span> Publicar Tarea
            </button>
          </nav>

          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <DashboardSwitchButton currentRole="student" />
            <AddRoleButton currentRole="student" />
            <div className="user-menu-container">
              <button className="user-avatar">
                <span className="avatar-icon">👤</span>
                <span className="user-name">{currentUserName}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Subheader y toolbar */}
      <header className="res-header">
        <h2 className="res-title">
          Reservar sesión con{" "}
          {location.state?.tutorName ? (
            <strong>{location.state.tutorName}</strong>
          ) : (
            <>tutor <span className="res-title-id">#{resolvedTutorId || "—"}</span></>
          )}
        </h2>

        <div className="res-toolbar">
          <button className="btn btn-secondary" onClick={prevWeek}>
            Semana anterior
          </button>
          <div className="res-range">
            {weekStart.format("LL")} – {weekStart.add(6, "day").format("LL")}
          </div>
          <button className="btn btn-secondary" onClick={nextWeek}>
            Semana siguiente
          </button>
          <div className="res-toolbar-split" />
          <button className="btn btn-secondary" onClick={prevMonth}>
            Mes anterior
          </button>
          <button className="btn btn-secondary" onClick={nextMonth}>
            Mes siguiente
          </button>
          <button className="btn btn-primary" onClick={goToday}>
            Hoy
          </button>
        </div>

        {error && <div className="res-error">{error}</div>}
      </header>

      {/* Grilla */}
      <main className="res-main">
        {loading ? (
          <div className="res-loading">Cargando disponibilidad…</div>
        ) : !hasGrid && (
        <div className="res-empty">No hay datos de disponibilidad para esta semana.</div>
        )}

        {hasGrid && (
        <div className="res-grid-wrap">
            <table className="res-grid">
            <thead>
                <tr>
                <th className="res-grid-hour">Hora</th>
                {grid.map((d) => (
                    <th key={d.day} className="res-grid-day">
                    {dayjs(d.day).format("ddd DD")}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody>
                {grid[0].slots.map((slot) => (
                <tr key={`${slot.start}-${slot.end}`}>
                    <td className="res-grid-hourcell">
                    {slot.start.slice(0, 5)}–{slot.end.slice(0, 5)}
                    </td>
                    {grid.map((d) => {
                    const daySlot = d.slots.find(s => s.start === slot.start && s.end === slot.end);
                    const disabled = !daySlot?.available;
                    return (
                        <td key={`${d.day}-${slot.start}-${slot.end}`} className="res-grid-slotcell">
                        <button
                            className={`res-slot-btn ${disabled ? "res-slot-btn--busy" : "res-slot-btn--free"}`}
                            disabled={disabled}
                            onClick={() => book(d.day, slot.start, slot.end)}
                        >
                            {disabled ? "Ocupado" : "Reservar"}
                        </button>
                        </td>
                    );
                    })}
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        )}
      </main>

      <footer className="res-footer">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Volver</button>
      </footer>
    </div>
  );
  
}

