// src/pages/TutorDashboard.tsxa
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import "../styles/TutorDashboard.css";
import { useAuthFlow } from "../utils/useAuthFlow";
import DashboardSwitchButton from "../components/DashboardSwitchButton";
import AddRoleButton from "../components/AddRoleButton";
import dayjs from "dayjs";
import "../styles/ReservationPage.css";
import {
  setDayAvailability,
  fetchWeekAvailability,
  listTutorReservations,
  type HourSlot,
} from "../service/Api-reservations";

interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  bio?: string;
  specializations?: string[];
  credentials?: string[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  educationLevel: string;
  joinDate: string;
  status: "active" | "inactive";
  sessionsCompleted: number;
}

interface TutoringRequest {
  id: string;
  studentName: string;
  subject: string;
  description: string;
  requestDate: string;
  status: "pending" | "accepted" | "rejected";
  priority: "low" | "medium" | "high";
}

interface TutoringSession {
  id: string;
  title: string;
  description: string;
  subject: string;
  date: string;
  time: string;
  duration: number; // en minutos
  price: number;
  maxStudents: number;
  enrolledStudents: number;
  status: "scheduled" | "completed" | "cancelled";
}

const TutorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { userRoles, isAuthenticated } = useAuthFlow();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "students" | "requests" | "sessions" | "create-session" | "availability"
  >("dashboard");

  // demo data
  const [students] = useState<Student[]>([
    { id: "1", name: "Ana García", email: "ana@student.com", educationLevel: "Pregrado", joinDate: "2025-09-01", status: "active", sessionsCompleted: 8 },
    { id: "2", name: "Carlos Mendoza", email: "carlos@student.com", educationLevel: "Secundaria", joinDate: "2025-08-15", status: "active", sessionsCompleted: 12 },
    { id: "3", name: "Lucía Torres", email: "lucia@student.com", educationLevel: "Pregrado", joinDate: "2025-09-10", status: "inactive", sessionsCompleted: 3 },
  ]);

  const [requests, setRequests] = useState<TutoringRequest[]>([
    { id: "1", studentName: "María López", subject: "Matemáticas", description: "Necesito ayuda con cálculo integral", requestDate: "2025-09-25", status: "pending", priority: "high" },
    { id: "2", studentName: "Pedro Ruiz", subject: "Programación", description: "Ayuda con React y TypeScript", requestDate: "2025-09-24", status: "pending", priority: "medium" },
    { id: "3", studentName: "Sofia Cruz", subject: "Física", description: "Problemas de cinemática", requestDate: "2025-09-23", status: "accepted", priority: "low" },
  ]);

  const [sessions, setSessions] = useState<TutoringSession[]>([
    { id: "1", title: "Introducción al Cálculo", description: "Conceptos básicos de límites y derivadas", subject: "Matemáticas", date: "2025-09-28", time: "14:00", duration: 60, price: 25000, maxStudents: 5, enrolledStudents: 3, status: "scheduled" },
    { id: "2", title: "React Avanzado", description: "Hooks personalizados y optimización", subject: "Programación", date: "2025-09-30", time: "16:00", duration: 90, price: 35000, maxStudents: 8, enrolledStudents: 6, status: "scheduled" },
  ]);

  const [newSession, setNewSession] = useState({
    title: "",
    description: "",
    subject: "",
    date: "",
    time: "",
    duration: 60,
    price: 25000,
    maxStudents: 5,
  });

  // Guardas token/sub para reutilizar
  const accessTk = auth.user?.access_token ?? "";
  const tutorSub = auth.user?.profile?.sub ?? "";

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!userRoles || !userRoles.includes("tutor")) {
      navigate("/");
      return;
    }
    if (auth.user) {
      setCurrentUser({
        userId: tutorSub || "unknown",
        name: auth.user.profile?.name || auth.user.profile?.nickname || "Tutor",
        email: auth.user.profile?.email || "No email",
        role: "tutor",
        bio: "Tutor profesional en UpLearn",
        specializations: ["Matemáticas", "Cálculo", "Álgebra"],
        credentials: ["Profesional Certificado"],
      });
    }
  }, [isAuthenticated, userRoles, navigate, auth.user, tutorSub]);

  const handleLogout = () => {
    auth.removeUser();
    navigate("/login");
  };

  const signOutRedirect = () => {
    const clientId = "lmk8qk12er8t8ql9phit3u12e";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://us-east-1splan606f.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleAcceptRequest = (requestId: string) =>
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: "accepted" } : r)));

  const handleRejectRequest = (requestId: string) =>
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" } : r)));

  const getPriorityColor = (priority: string) =>
    priority === "high" ? "#ef4444" : priority === "medium" ? "#f59e0b" : "#10b981";

  const getStatusColor = (status: string) =>
    status === "accepted"
      ? "#10b981"
      : status === "rejected"
      ? "#ef4444"
      : status === "pending"
      ? "#f59e0b"
      : status === "active"
      ? "#10b981"
      : status === "inactive"
      ? "#6b7280"
      : status === "scheduled"
      ? "#3b82f6"
      : status === "completed"
      ? "#10b981"
      : "#ef4444";

  if (auth.isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: 18 }}>
        ⏳ Verificando acceso de tutor...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: 18 }}>
        🔍 Cargando información del tutor...
      </div>
    );
  }

  return (
    <div className="tutor-dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <h2>UpLearn Tutor</h2>
          </div>

          <nav className="main-nav">
            <button className={`nav-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}>
              <span>📊</span> Dashboard
            </button>
            <button className={`nav-item ${activeSection === "students" ? "active" : ""}`} onClick={() => setActiveSection("students")}>
              <span>👥</span> Mis Estudiantes
            </button>
            <button className={`nav-item ${activeSection === "requests" ? "active" : ""}`} onClick={() => setActiveSection("requests")}>
              <span>📬</span> Solicitudes
            </button>
            <button className={`nav-item ${activeSection === "sessions" ? "active" : ""}`} onClick={() => setActiveSection("sessions")}>
              <span>🎓</span> Mis Clases
            </button>
            <button className={`nav-item ${activeSection === "availability" ? "active" : ""}`} onClick={() => setActiveSection("availability")}>
              <span>🗓️</span> Mi disponibilidad
            </button>
            <button className={`nav-item ${activeSection === "create-session" ? "active" : ""}`} onClick={() => setActiveSection("create-session")}>
              <span>➕</span> Nueva Clase
            </button>
          </nav>

          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <DashboardSwitchButton currentRole="tutor" />
            <AddRoleButton currentRole="tutor" />

            <div className="user-menu-container">
              <button className="user-avatar" onClick={() => setShowUserMenu((v) => !v)}>
                <span className="avatar-icon">👨‍🏫</span>
                <span className="user-name">{currentUser.name}</span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <p className="user-email">{currentUser.email}</p>
                    <p className="user-role">Tutor Profesional</p>
                    <small style={{ color: "#666", fontSize: "0.8rem" }}>Autenticado con AWS Cognito</small>
                    <div style={{ fontSize: "0.75rem", marginTop: 4 }}>
                      <span style={{ color: "#10b981" }}>✅ Conectado</span>
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => navigate("/edit-profile", { state: { currentRole: "tutor" } })}>
                    <span>✏️</span> Editar Perfil
                  </button>
                  <button className="dropdown-item" onClick={handleLogout}>
                    <span>🚪</span> Cerrar Sesión (Local)
                  </button>
                  <button className="dropdown-item logout" onClick={signOutRedirect}>
                    <span>🔐</span> Cerrar Sesión (Cognito)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {activeSection === "dashboard" && (
          <div className="dashboard-content">
            <h1>¡Bienvenido, {currentUser.name}! 👨‍🏫</h1>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>{students.length}</h3>
                  <p>Estudiantes Totales</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📬</div>
                <div className="stat-info">
                  <h3>{requests.filter((r) => r.status === "pending").length}</h3>
                  <p>Solicitudes Pendientes</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🎓</div>
                <div className="stat-info">
                  <h3>{sessions.filter((s) => s.status === "scheduled").length}</h3>
                  <p>Clases Programadas</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>
                    $
                    {sessions
                      .reduce((acc, s) => acc + s.price * s.enrolledStudents, 0)
                      .toLocaleString()}
                  </h3>
                  <p>Ingresos Estimados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "students" && (
          <div className="students-section">
            <h1>Mis Estudiantes 👥</h1>
            <div className="students-grid">
              {students.map((student) => (
                <div key={student.id} className="student-card">
                  <div className="student-header">
                    <div className="student-avatar">🎓</div>
                    <div className="student-info">
                      <h3>{student.name}</h3>
                      <p className="student-email">{student.email}</p>
                      <span className="status-badge" style={{ color: getStatusColor(student.status) }}>
                        {student.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>

                  <div className="student-details">
                    <p>
                      <strong>Nivel:</strong> {student.educationLevel}
                    </p>
                    <p>
                      <strong>Se unió:</strong> {student.joinDate}
                    </p>
                    <p>
                      <strong>Sesiones completadas:</strong> {student.sessionsCompleted}
                    </p>
                  </div>

                  <div className="student-actions">
                    <button className="btn-primary">Enviar Mensaje</button>
                    <button className="btn-secondary">Ver Historial</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "requests" && (
          <div className="requests-section">
            <h1>Solicitudes de Tutoría 📬</h1>
            <div className="requests-grid">
              {requests.map((request) => (
                <div key={request.id} className="request-card">
                  <div className="request-header">
                    <h3>{request.studentName}</h3>
                    <div className="request-meta">
                      <span className="priority-badge" style={{ backgroundColor: getPriorityColor(request.priority) }}>
                        {request.priority.toUpperCase()}
                      </span>
                      <span className="status-badge" style={{ color: getStatusColor(request.status) }}>
                        {request.status === "pending" ? "PENDIENTE" : request.status === "accepted" ? "ACEPTADA" : "RECHAZADA"}
                      </span>
                    </div>
                  </div>

                  <div className="request-content">
                    <p>
                      <strong>Materia:</strong> {request.subject}
                    </p>
                    <p>
                      <strong>Descripción:</strong> {request.description}
                    </p>
                    <p>
                      <strong>Fecha:</strong> {request.requestDate}
                    </p>
                  </div>

                  {request.status === "pending" && (
                    <div className="request-actions">
                      <button className="btn-primary" onClick={() => handleAcceptRequest(request.id)}>
                        Aceptar
                      </button>
                      <button className="btn-danger" onClick={() => handleRejectRequest(request.id)}>
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "sessions" && (
          <div className="sessions-section">
            <h1>Mis Clases 🎓</h1>
            <div className="sessions-grid">
              {sessions.map((session) => (
                <div key={session.id} className="session-card">
                  <div className="session-header">
                    <h3>{session.title}</h3>
                    <span className="status-badge" style={{ color: getStatusColor(session.status) }}>
                      {session.status === "scheduled" ? "PROGRAMADA" : session.status === "completed" ? "COMPLETADA" : "CANCELADA"}
                    </span>
                  </div>

                  <p className="session-description">{session.description}</p>

                  <div className="session-details">
                    <div className="session-info">
                      <p>
                        <strong>📚 Materia:</strong> {session.subject}
                      </p>
                      <p>
                        <strong>📅 Fecha:</strong> {session.date}
                      </p>
                      <p>
                        <strong>🕐 Hora:</strong> {session.time}
                      </p>
                      <p>
                        <strong>⏱️ Duración:</strong> {session.duration} min
                      </p>
                    </div>
                    <div className="session-stats">
                      <p>
                        <strong>💰 Precio:</strong> ${session.price.toLocaleString()}
                      </p>
                      <p>
                        <strong>👥 Estudiantes:</strong> {session.enrolledStudents}/{session.maxStudents}
                      </p>
                    </div>
                  </div>

                  <div className="session-actions">
                    <button className="btn-primary">Ver Detalles</button>
                    <button className="btn-secondary">Editar</button>
                    {session.status === "scheduled" && <button className="btn-danger">Cancelar</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "availability" && (
          <AvailabilityPanel tutorSub={tutorSub} token={accessTk} />
        )}

        {activeSection === "create-session" && (
          <div className="create-session-section">
            <h1>Crear Nueva Clase ➕</h1>

            <div className="session-form-container">
              <div className="session-form">
                <div className="form-group">
                  <label>Título de la Clase</label>
                  <input
                    type="text"
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    placeholder="Ej: Introducción al Cálculo Diferencial"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    value={newSession.description}
                    onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
                    placeholder="Describe los temas que se cubrirán..."
                    className="form-textarea"
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Materia</label>
                    <select
                      value={newSession.subject}
                      onChange={(e) => setNewSession({ ...newSession, subject: e.target.value })}
                      className="form-select"
                    >
                      <option value="">Seleccionar materia</option>
                      <option value="Matemáticas">Matemáticas</option>
                      <option value="Física">Física</option>
                      <option value="Química">Química</option>
                      <option value="Programación">Programación</option>
                      <option value="Inglés">Inglés</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Fecha</label>
                    <input
                      type="date"
                      value={newSession.date}
                      onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hora</label>
                    <input
                      type="time"
                      value={newSession.time}
                      onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Duración (minutos)</label>
                    <select
                      value={newSession.duration}
                      onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value, 10) })}
                      className="form-select"
                    >
                      <option value={30}>30 minutos</option>
                      <option value={60}>1 hora</option>
                      <option value={90}>1.5 horas</option>
                      <option value={120}>2 horas</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Precio ($)</label>
                    <input
                      type="number"
                      value={newSession.price}
                      onChange={(e) => setNewSession({ ...newSession, price: parseInt(e.target.value, 10) })}
                      className="form-input"
                      min={10000}
                      step={5000}
                    />
                  </div>

                  <div className="form-group">
                    <label>Máximo de Estudiantes</label>
                    <select
                      value={newSession.maxStudents}
                      onChange={(e) => setNewSession({ ...newSession, maxStudents: parseInt(e.target.value, 10) })}
                      className="form-select"
                    >
                      <option value={1}>1 estudiante</option>
                      <option value={3}>3 estudiantes</option>
                      <option value={5}>5 estudiantes</option>
                      <option value={8}>8 estudiantes</option>
                      <option value={10}>10 estudiantes</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    className="btn-primary btn-large"
                    onClick={() => {
                      if (newSession.title && newSession.subject && newSession.date && newSession.time) {
                        const session: TutoringSession = {
                          id: Date.now().toString(),
                          ...newSession,
                          enrolledStudents: 0,
                          status: "scheduled",
                        };
                        setSessions((prev) => [...prev, session]);
                        setNewSession({
                          title: "",
                          description: "",
                          subject: "",
                          date: "",
                          time: "",
                          duration: 60,
                          price: 25000,
                          maxStudents: 5,
                        });
                        alert("¡Sesión creada!");
                      }
                    }}
                  >
                    Crear Clase
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setNewSession({
                        title: "",
                        description: "",
                        subject: "",
                        date: "",
                        time: "",
                        duration: 60,
                        price: 25000,
                        maxStudents: 5,
                      })
                    }
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TutorDashboard;

/* ============ Subcomponentes ============ */

type AvailabilityPanelProps = { tutorSub: string; token: string };

const AvailabilityPanel: React.FC<AvailabilityPanelProps> = ({ tutorSub, token }) => {
  const [day, setDay] = useState<string>(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<HourSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // hora mínima (siguiente hora redondeada si es hoy)
  const today = dayjs().format("YYYY-MM-DD");
  const nextHour = useMemo(() => dayjs().add(1, "hour").startOf("hour"), []);
  const minStartStr = day === today ? nextHour.format("HH:00") : "00:00";

  const [newStart, setNewStart] = useState<string>(minStartStr);
  const [newEnd, setNewEnd] = useState<string>(dayjs(minStartStr, "HH:mm").add(1, "hour").format("HH:00"));

  const toHH00 = (t: string): string => `${(t || "00:00").slice(0, 2)}:00`;

  const loadDay = async () => {
    if (!tutorSub) return;
    setLoading(true);
    try {
      // Para pintar grid usamos 60 min y día 08–20 (ajústalo si quieres)
      const weekStart = dayjs(day).startOf("week").add(1, "day").format("YYYY-MM-DD");
      const grid = await fetchWeekAvailability(tutorSub, weekStart, 60, "08:00", "20:00");
      const arr: HourSlot[] = (grid[day] || []).map((s: any) => ({ start: s.start.slice(0, 5), end: s.end.slice(0, 5) }));
      setSlots(arr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const start = minStartStr;
    const end = dayjs(start, "HH:mm").add(1, "hour").format("HH:00");
    setNewStart(start);
    setNewEnd(end);
    // carga inicial del día
    void loadDay();
  }, [day]);

  const addSlot = () => {
    const hhStart = toHH00(newStart);
    const hhEnd = toHH00(newEnd);
    if (hhStart < minStartStr && day === today) {
      alert(`El inicio mínimo permitido hoy es ${minStartStr}`);
      setNewStart(minStartStr);
      setNewEnd(dayjs(minStartStr, "HH:mm").add(1, "hour").format("HH:00"));
      return;
    }
    if (hhStart >= hhEnd) {
      alert("El inicio debe ser menor que el fin");
      return;
    }
    setSlots((prev) => {
      const exists = prev.some((s) => s.start === hhStart && s.end === hhEnd);
      if (exists) return prev;
      const next = [...prev, { start: hhStart, end: hhEnd }];
      next.sort((a, b) => a.start.localeCompare(b.start));
      return next;
    });
  };

  const removeSlot = (s: HourSlot) =>
    setSlots((prev) => prev.filter((x) => !(x.start === s.start && x.end === s.end)));

  const save = async () => {
    if (!tutorSub) return alert("No se pudo leer tu sub del token");
    setSaving(true);
    try {
      await setDayAvailability(tutorSub, day, slots, token); // añade X-App-Role en el servicio
      alert("Disponibilidad guardada");
    } catch (e: any) {
      alert(e?.message || "Error guardando disponibilidad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tutor-availability-section">
      <h1>Disponibilidad 🗓️</h1>

      <div className="res-grid-wrap" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label>
            Día:&nbsp;
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>

          <label>
            Inicio:&nbsp;
            <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} min={minStartStr} step={3600} />
          </label>

          <label>
            Fin:&nbsp;
            <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} min={dayjs(newStart, "HH:mm").add(1, "hour").format("HH:00")} step={3600} />
          </label>

          <button className="btn-primary" onClick={addSlot}>
            Agregar franja
          </button>
          <button className="btn-secondary" onClick={loadDay} disabled={loading}>
            {loading ? "Cargando…" : "Recargar del servidor"}
          </button>
        </div>

        {slots.length === 0 ? (
          <div className="res-empty">Aún no hay franjas para este día.</div>
        ) : (
          <table className="res-grid">
            <thead>
              <tr>
                <th className="res-grid-hour">Inicio</th>
                <th className="res-grid-day">Fin</th>
                <th className="res-grid-day">Acción</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, i) => (
                <tr key={`${s.start}-${s.end}-${i}`}>
                  <td className="res-grid-hourcell">{s.start}</td>
                  <td className="res-grid-slotcell">{s.end}</td>
                  <td className="res-grid-slotcell">
                    <button className="btn-secondary" onClick={() => removeSlot(s)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar disponibilidad"}
          </button>
        </div>
      </div>
    </div>
  );
};
