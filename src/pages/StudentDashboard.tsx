import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import '../styles/StudentDashboard.css';
import '../styles/Calendar.css';
import { useAuthFlow } from '../utils/useAuthFlow';
import { useProfileStatus } from '../utils/useProfileStatus';
import ApiSearchService from '../service/Api-search';
import {
  getMyReservations,
  cancelReservation,
  type Reservation as ApiReservation,
} from '../service/Api-scheduler';
import DashboardSwitchButton from '../components/DashboardSwitchButton';
import AddRoleButton from '../components/AddRoleButton';
import ProfileIncompleteNotification from '../components/ProfileIncompleteNotification';
import { ENV } from '../utils/env';

// --- Funciones de Utilidad ---

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayLocalISO(): string {
  return toISODateLocal(new Date());
}

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  const day = d.getDay(); // 0=Dom..6=Sáb
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return toISODateLocal(d);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

function formatTime(timeStr: string): string {
    const s = (timeStr ?? '').trim();
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
}

// --- Lógica de Estados Dinámicos ---

function getEffectiveStatus(res: ApiReservation): ApiReservation['status'] {
  const now = new Date();
  const startTime = new Date(`${res.date}T${formatTime(res.start)}`);
  const endTime = new Date(`${res.date}T${formatTime(res.end)}`);
  const rawStatus = res.status;

  if (rawStatus === 'PENDIENTE') {
    if (now > endTime) return 'VENCIDA';
    return 'PENDIENTE';
  }

  if (rawStatus === 'ACEPTADO') {
    if (now >= startTime && now <= endTime) return 'ACTIVA';
    if (now > endTime) {
      return res.attended === false ? 'INCUMPLIDA' : 'FINALIZADA';
    }
    return 'ACEPTADO';
  }
  return rawStatus;
}

// --- Interfaces ---

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
  hourlyRate?: number;
}
interface Task {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
}
interface Reservation extends ApiReservation {
  tutorName?: string;
  effectiveStatus: ApiReservation['status'];
}
type PublicProfile = {
  id?: string;
  sub?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  credentials?: string[];
  specializations?: string[];
};

async function fetchPublicProfileByIdOrSub(base: string, path: string, idOrSub: string, token?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const tryQuery = async (key: 'id' | 'sub') => {
    const url = `${base}${path}?${key}=${encodeURIComponent(idOrSub)}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return { ok: false, status: resp.status };
    return { ok: true, raw: await resp.json() };
  };
  let r = await tryQuery('id');
  if (!r.ok) r = await tryQuery('sub');
  if (!r.ok) throw Object.assign(new Error('PROFILE_FETCH_FAILED'), { status: r.status });
  return r.raw;
}

type ActiveSection = 'dashboard' | 'find-tutors' | 'my-tasks' | 'post-task' | 'my-reservations' | 'none';

interface AppHeaderProps {
  currentUser: User | null;
  activeSection?: ActiveSection;
  onSectionChange?: (section: ActiveSection) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ currentUser, activeSection = 'none', onSectionChange = () => {} }) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    auth.removeUser();
    const clientId = "342s18a96gl2pbaroorqh316l8";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://us-east-18mvprkbvu.auth.us-east-1.amazoncognito.com";
    globalThis.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleEditProfile = () => { navigate('/edit-profile', { state: { currentRole: 'student' } }); };

  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="logo"><h2>UpLearn Student</h2></div>
        <nav className="main-nav">
          <button className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => onSectionChange('dashboard')}><span>📊</span> Dashboard</button>
          <button className={`nav-item ${activeSection === 'find-tutors' ? 'active' : ''}`} onClick={() => onSectionChange('find-tutors')}><span>🔍</span> Buscar Tutores</button>
          <button className={`nav-item ${activeSection === 'my-reservations' ? 'active' : ''}`} onClick={() => onSectionChange('my-reservations')}><span>🗓️</span> Mis Reservas</button>
          <button className={`nav-item ${activeSection === 'my-tasks' ? 'active' : ''}`} onClick={() => onSectionChange('my-tasks')}><span>📋</span> Mis Tareas</button>
          <button className={`nav-item ${activeSection === 'post-task' ? 'active' : ''}`} onClick={() => onSectionChange('post-task')}><span>➕</span> Publicar Tarea</button>
        </nav>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="user-menu-container">
            <button className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="avatar-icon">👤</span>
              <span className="user-name">{currentUser?.name ?? 'Usuario'}</span>
              <span className="dropdown-arrow">▼</span>
            </button>
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-info">
                  <p className="user-email">{currentUser?.email ?? 'No email'}</p>
                  <p className="user-role">Estudiante{currentUser?.educationLevel ? ` - ${currentUser.educationLevel}` : ''}</p>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleEditProfile}><span>✏️</span> Editar Perfil</button>
                <AddRoleButton currentRole="student" asMenuItem={true} />
                <DashboardSwitchButton currentRole="student" asMenuItem={true} />
                <button className="dropdown-item logout" onClick={handleLogout}><span>🚪</span> Cerrar Sesión</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      setToken((auth.user as any)?.id_token ?? auth.user?.access_token);
    } else {
      setToken(undefined);
    }
  }, [auth.isAuthenticated, auth.user]);

  const { userRoles, isAuthenticated, needsRoleSelection } = useAuthFlow();
  const { isProfileComplete, missingFields } = useProfileStatus();
  const [showProfileNotification, setShowProfileNotification] = useState(true);

  // CAMBIO: La sección por defecto es 'dashboard'
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  const subjects = ['Matemáticas', 'Física', 'Química', 'Programación', 'Inglés', 'Historia', 'Biología'];
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tutors, setTutors] = useState<TutorCard[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [errorSearch, setErrorSearch] = useState<string>('');

  const [weekStart, setWeekStart] = useState(() => mondayOf(todayLocalISO()));
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  // CAMBIO: Estado para la paginación
  const [currentPage, setCurrentPage] = useState(1);
  const RESERVATIONS_PER_PAGE = 15;

  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Tarea de Cálculo', description: 'Resolver ejercicios de derivadas', subject: 'Matemáticas', dueDate: '2025-10-01', priority: 'high', status: 'pending' },
    { id: '2', title: 'Proyecto de Programación', description: 'Crear una aplicación web con React', subject: 'Programación', dueDate: '2025-10-05', priority: 'medium', status: 'in_progress' }
  ]);
  const [newTask, setNewTask] = useState({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' as const });

  const USERS_BASE = ENV.USERS_BASE;
  const PROFILE_PATH = ENV.USERS_PROFILE_PATH;

  useEffect(() => {
    if (isAuthenticated === null || userRoles === null) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    if (needsRoleSelection) { navigate('/role-selection'); return; }
    if (!userRoles?.includes('student')) { navigate('/'); return; }
    if (auth.user) {
      setCurrentUser({
        userId: auth.user.profile?.sub || 'unknown',
        name: auth.user.profile?.name || auth.user.profile?.nickname || 'Usuario',
        email: auth.user.profile?.email || 'No email',
        role: 'student',
      });
    }
  }, [isAuthenticated, userRoles, needsRoleSelection, navigate, auth.user]);

  const [profilesByTutorId, setProfilesByTutorId] = useState<Record<string, PublicProfile>>({});

  const loadMyReservations = async () => {
    if (!token) return;
    // Cargar un rango amplio para que la navegación entre semanas no requiera fetches constantes
    const from = addDays(weekStart, -35); 
    const to = addDays(weekStart, 35);
    try {
      setReservationsLoading(true);
      const data = await getMyReservations(from, to, token);
      const reservationsWithStatus = data.map(r => ({ ...r, effectiveStatus: getEffectiveStatus(r) }));
      setMyReservations(reservationsWithStatus);
    } catch (e: any) {
      console.error("getMyReservations falló:", e?.message || e);
      setMyReservations([]);
    } finally {
      setReservationsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
        // Cargar las reservas independientemente de la sección activa para el badge del dashboard
        loadMyReservations();
    }
  }, [token]);

  // Recargar si cambia la semana
  useEffect(() => {
    if (activeSection === 'my-reservations' && token) {
        loadMyReservations();
    }
  }, [weekStart, activeSection, token]);


  useEffect(() => {
    const ids = Array.from(new Set(myReservations.map(r => r.tutorId).filter(Boolean)))
      .filter(id => !profilesByTutorId[id]);
    if (ids.length === 0 || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const settled = await Promise.allSettled(
          ids.map(async (idOrSub) => {
            const raw = await fetchPublicProfileByIdOrSub(USERS_BASE, PROFILE_PATH, idOrSub, token);
            return { id: idOrSub, prof: raw };
          })
        );
        if (cancelled) return;
        const next: Record<string, PublicProfile> = {};
        for (const r of settled) {
          if (r.status === 'fulfilled') {
            next[r.value.id] = {
              id: r.value.prof?.id,
              sub: r.value.prof?.sub,
              name: r.value.prof?.name || r.value.prof?.fullName || 'Tutor',
              email: r.value.prof?.email,
              avatarUrl: r.value.prof?.avatarUrl,
              credentials: r.value.prof?.credentials,
              specializations: r.value.prof?.specializations,
            };
          }
        }
        if (Object.keys(next).length > 0) setProfilesByTutorId(prev => ({ ...prev, ...next }));
      } catch (e) { console.warn('Enriquecimiento de perfiles fallido', e); }
    })();
    return () => { cancelled = true; };
  }, [myReservations, profilesByTutorId, USERS_BASE, PROFILE_PATH, token]);

  const handleSearchTutors = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoadingSearch(true);
    setErrorSearch('');
    try {
      const result = await ApiSearchService.searchTutors(searchQuery);
      setTutors(result || []);
    } catch (err: any) {
      setErrorSearch(err?.message || 'Error en la búsqueda');
    } finally {
      setLoadingSearch(false);
    }
  };

  const cancelTutorReservation = async (id: string, status?: string | null) => {
    if (!token) return;
    if (status?.toUpperCase() !== 'PENDIENTE') {
      alert("Solo se pueden cancelar reservas con estado PENDIENTE.");
      return;
    }
    if (globalThis.confirm("¿Seguro que quieres cancelar esta reserva?")) {
      await cancelReservation(id, token);
      await loadMyReservations();
    }
  };

  const handlePostTask = () => {
    if (newTask.title && newTask.description && newTask.subject) {
      const task: Task = { id: Date.now().toString(), ...newTask, status: 'pending' };
      setTasks(prev => [...prev, task]);
      setNewTask({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' });
      alert('Tarea publicada exitosamente!');
    }
  };

  const getPriorityColor = (priority: string) => ({ high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[priority] || '#6b7280');
  const getStatusColor = (status: string) => ({ completed: '#10b981', in_progress: '#3b82f6', pending: '#6b7280', ACEPTADO: '#10b981' }[status] || '#6b7280');

  const statusBadge = (status?: string | null) => {
    const s = (status || '').toUpperCase();
    const styles: { [key: string]: { label: string; color: string; bg: string } } = {
        'CANCELADO': { label: 'CANCELADO', color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
        'PENDIENTE': { label: 'PENDIENTE', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
        'ACEPTADO': { label: 'ACEPTADA', color: '#10b981', bg: 'rgba(16,185,129,.12)' },
        'ACTIVA': { label: 'ACTIVA', color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
        'INCUMPLIDA': { label: 'INCUMPLIDA', color: '#f97316', bg: 'rgba(249,115,22,.12)' },
        'FINALIZADA': { label: 'FINALIZADA', color: '#0ea5e9', bg: 'rgba(14, 165, 233, .12)'},
        'VENCIDA': { label: 'VENCIDA', color: '#6b7280', bg: 'rgba(107,114,128,.15)' },
    };
    return styles[s] || { label: s, color: '#6b7280', bg: 'rgba(107,114,128,.12)' };
  };

  const weekReservations = myReservations.filter(r => {
    const resDate = new Date(r.date + 'T00:00:00');
    const weekStartDate = new Date(weekStart + 'T00:00:00');
    const weekEndDate = new Date(addDays(weekStart, 6) + 'T00:00:00');
    return resDate >= weekStartDate && resDate <= weekEndDate;
  });

  const visibleReservations = showCancelled
    ? weekReservations
    : weekReservations.filter(r => r.effectiveStatus !== 'CANCELADO');

  // CAMBIO: Lógica de paginación
  const totalPages = Math.max(1, Math.ceil(visibleReservations.length / RESERVATIONS_PER_PAGE));
  const paginatedReservations = visibleReservations.slice(
      (currentPage - 1) * RESERVATIONS_PER_PAGE,
      currentPage * RESERVATIONS_PER_PAGE
  );
  // Resetear página si los filtros cambian
  useEffect(() => {
    setCurrentPage(1);
  }, [weekStart, showCancelled]);


  if (auth.isLoading) return <div className="full-center">⏳ Verificando acceso...</div>;
  if (!currentUser) return <div className="full-center">🔍 Cargando información...</div>;

  return (
    <div className="dashboard-container">
      {!isProfileComplete && showProfileNotification && missingFields && (
        <ProfileIncompleteNotification
          missingFields={missingFields}
          currentRole="student"
          onDismiss={() => setShowProfileNotification(false)}
        />
      )}
      <AppHeader currentUser={currentUser} activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="dashboard-main">
        {activeSection === 'dashboard' && (
          <div className="dashboard-content">
            <h1>¡Bienvenido, {currentUser.name}! 👋</h1>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon">📚</div><div className="stat-info"><h3>{tasks.length}</h3><p>Tareas Activas</p></div></div>
              <div className="stat-card"><div className="stat-icon">👨‍🏫</div><div className="stat-info"><h3>{tutors.length}</h3><p>Tutores Encontrados</p></div></div>
              <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><h3>{tasks.filter(t => t.status === 'completed').length}</h3><p>Tareas Completadas</p></div></div>
              <div className="stat-card"><div className="stat-icon">🗓️</div><div className="stat-info"><h3>{myReservations.filter(r=>r.effectiveStatus !== 'CANCELADO').length}</h3><p>Reservas Próximas</p></div></div>
            </div>
            <div className="recent-activity">
              <h2>Actividad Reciente</h2>
              <div className="activity-list">
                {tasks.length > 0 && <div className="activity-item"><span className="activity-icon">📝</span><div className="activity-content"><p><strong>Nueva tarea:</strong> {tasks[0]?.title}</p><small>Hace 2 horas</small></div></div>}
                {myReservations.length > 0 && <div className="activity-item"><span className="activity-icon">🗓️</span><div className="activity-content"><p><strong>Reserva:</strong> {myReservations[0].date} a las {formatTime(myReservations[0].start)}</p><small>Ayer</small></div></div>}
              </div>
            </div>
          </div>
        )}
        {activeSection === 'find-tutors' && (
          <div className="tutors-section">
            <h1>Buscar Tutores 🔍</h1>
            <section className="tutor-search">
              <form onSubmit={handleSearchTutors} className="tutor-search-form">
                <input type="text" placeholder="Ej: java, cálculo, María..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <button type="submit" disabled={loadingSearch}>{loadingSearch ? 'Buscando...' : 'Buscar'}</button>
              </form>
              {errorSearch && <p className="error">{errorSearch}</p>}
              <div className="tutor-results">
                {tutors.length === 0 && !loadingSearch && <p>No hay resultados. Prueba con “java”.</p>}
                {tutors.map((tutor) => (
                  <div key={tutor.userId} className="tutor-card">
                    <div className="tutor-card-header"><div className="tutor-title"><strong className="tutor-name">{tutor.name}</strong><br /><span className="tutor-email">{tutor.email}</span></div></div>
                    {tutor.bio && <p className="tutor-bio">{tutor.bio}</p>}
                    {tutor.specializations && tutor.specializations.length > 0 && (<div className="tutor-tags">{tutor.specializations.map(s => (<span key={s} className="tag">{s}</span>))}</div>)}
                    <div className="tutor-actions">
                      <button className="btn-secondary" onClick={() => navigate(`/profile/tutor/${tutor.userId}`, { state: { profile: tutor } })}>Ver Perfil</button>
                      <button className="btn-primary" onClick={() => navigate(`/book/${tutor.userId}`, { state: { tutor, role: 'tutor' } })}>Reservar Cita</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
        {activeSection === 'my-reservations' && (
          <div className="tasks-section">
            <h1>Mis Reservas 🗓️</h1>
            <div className="card card--primary-soft reservations-panel">
              <div className="week-toolbar">
                <button className='btn btn-ghost' onClick={() => setWeekStart(addDays(weekStart, -7))}>&laquo; Anterior</button>
                <div className='week-toolbar__title'>Semana del {weekStart} al {addDays(weekStart, 6)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className='btn' onClick={() => setShowCancelled(!showCancelled)}>{showCancelled ? 'Ocultar canceladas' : 'Ver canceladas'}</button>
                  <button className='btn btn-ghost' onClick={() => setWeekStart(addDays(weekStart, 7))}>Siguiente &raquo;</button>
                </div>
              </div>
              {reservationsLoading && <div className="empty-note">Cargando reservas…</div>}
              {!reservationsLoading && visibleReservations.length === 0 && (
                <div className="empty-note">{showCancelled ? "No tienes reservas esta semana." : "No tienes reservas activas esta semana."}</div>
              )}
              <div className="reservations-list">
                {paginatedReservations.map((r) => {
                  const b = statusBadge(r.effectiveStatus);
                  const prof = profilesByTutorId[r.tutorId];
                  const tutorName = prof?.name || r.tutorName || 'Tutor';
                  const canCancel = r.effectiveStatus === 'PENDIENTE';
                  
                  return (
                    <article key={r.id} className="reservation-card">
                      <header className="reservation-card__header">
                        <h3 className="reservation-card__title">Reserva con {tutorName}</h3>
                        <span className="status-pill" style={{ color: b.color, background: b.bg }}>{b.label}</span>
                      </header>
                      <div className="reservation-card__meta">
                        <span>🗓️ {r.date}</span>
                        <span>⏰ {formatTime(r.start)} – {formatTime(r.end)}</span>
                      </div>
                      <div className="reservation-card__actions">
                        <button type="button" className="btn btn-danger" onClick={() => cancelTutorReservation(r.id, r.effectiveStatus)} disabled={!canCancel} title={canCancel ? 'Cancelar esta reserva' : 'No se puede cancelar en este estado'}>
                          Cancelar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {/* CAMBIO: Controles de Paginación */}
              {visibleReservations.length > RESERVATIONS_PER_PAGE && (
                  <div className="pagination-controls" style={{marginTop: '20px', textAlign: 'center'}}>
                      <button className="btn btn-ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                          Anterior
                      </button>
                      <span style={{margin: '0 15px', color: 'white', fontWeight: 'bold'}}>
                          Página {currentPage} de {totalPages}
                      </span>
                      <button className="btn btn-ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                          Siguiente
                      </button>
                  </div>
              )}
            </div>
          </div>
        )}
        {activeSection === 'my-tasks' && (
          <div className="tasks-section">
            <h1>Mis Tareas 📋</h1>
            <div className="tasks-grid">
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-header"><h3>{task.title}</h3><div className="task-meta"><span className="priority-badge" style={{ backgroundColor: getPriorityColor(task.priority) }}>{task.priority.toUpperCase()}</span><span className="status-badge" style={{ color: getStatusColor(task.status) }}>{task.status.replace('_', ' ').toUpperCase()}</span></div></div>
                  <p className="task-description">{task.description}</p>
                  <div className="task-details"><span className="task-subject">📚 {task.subject}</span><span className="task-due-date">📅 {task.dueDate}</span></div>
                  <div className="task-actions"><button className="btn-primary">Ver Detalles</button><button className="btn-secondary">Editar</button></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeSection === 'post-task' && (
          <div className="post-task-section">
            <h1>Publicar Nueva Tarea ➕</h1>
            <div className="task-form-container">
              <div className="task-form">
                <div className="form-group"><label htmlFor="task-title">Título</label><input id="task-title" type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Ej: Ayuda con cálculo" className="form-input"/></div>
                <div className="form-group"><label htmlFor="task-description">Descripción</label><textarea id="task-description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Describe lo que necesitas..." className="form-textarea" rows={4}/></div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="task-subject">Materia</label><select id="task-subject" value={newTask.subject} onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })} className="form-select"><option value="">Seleccionar materia</option>{subjects.map(subject => (<option key={subject} value={subject}>{subject}</option>))}</select></div>
                  <div className="form-group"><label htmlFor="task-due-date">Fecha Límite</label><input id="task-due-date" type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="form-input"/></div>
                </div>
                <fieldset className="form-group"><legend>Prioridad</legend><div className="priority-options">{['low', 'medium', 'high'].map(priority => (<label key={priority} className="priority-option" htmlFor={`priority-${priority}`}><input id={`priority-${priority}`} type="radio" name="priority" value={priority} checked={newTask.priority === priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}/><span className="priority-label" style={{ color: getPriorityColor(priority) }}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span></label>))}</div></fieldset>
                <div className="form-actions"><button className="btn-primary btn-large" onClick={handlePostTask}>Publicar Tarea</button><button className="btn-secondary" onClick={() => setNewTask({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' })}>Limpiar</button></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;