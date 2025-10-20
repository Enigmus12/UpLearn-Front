import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import '../styles/StudentDashboard.css';
import '../styles/Calendar.css';
import { useAuthFlow } from '../utils/useAuthFlow';
import ApiSearchService from '../service/Api-search';
import {
  getMyReservations,
  cancelReservation,
  type Reservation as ApiReservation,
} from '../service/Api-scheduler';
import DashboardSwitchButton from '../components/DashboardSwitchButton';
import AddRoleButton from '../components/AddRoleButton';

// Utilidades de fecha
function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  const day = d.getDay(); // 0..6 (Domingo..Sábado)
  const diff = (day === 0 ? -6 : 1) - day; // Lunes como inicio
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Tipos
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
}
// Página principal del dashboard para estudiantes
const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  // Token de autenticación
  const [token, setToken] = useState<string | undefined>(undefined);
  // Actualizar token cuando cambie el estado de autenticación
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const idToken = (auth.user as any)?.id_token as string | undefined;
      const accessToken = auth.user?.access_token as string | undefined;
      const finalToken = idToken ?? accessToken;
      setToken(finalToken);
    } else {
      setToken(undefined);
    }
  }, [auth.isAuthenticated, auth.user]);
  // Obtener estado de autenticación y roles
  const { userRoles, isAuthenticated, needsRoleSelection } = useAuthFlow();

  // Estado general
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'dashboard' | 'find-tutors' | 'my-tasks' | 'post-task' | 'my-reservations'
  >('dashboard');
  // Lista de materias para tareas
  const subjects = ['Matemáticas', 'Física', 'Química', 'Programación', 'Inglés', 'Historia', 'Biología'];

  // Búsqueda de tutores
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tutors, setTutors] = useState<TutorCard[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [errorSearch, setErrorSearch] = useState<string>('');

  // Reservas propias
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date().toISOString().slice(0, 10)));
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  // Tareas
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Tarea de Cálculo', description: 'Resolver ejercicios de derivadas', subject: 'Matemáticas', dueDate: '2025-10-01', priority: 'high', status: 'pending' },
    { id: '2', title: 'Proyecto de Programación', description: 'Crear una aplicación web con React', subject: 'Programación', dueDate: '2025-10-05', priority: 'medium', status: 'in_progress' }
  ]);
  const [newTask, setNewTask] = useState({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' as const });

  // Guardas y redirecciones de auth/rol
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

  // Cargar reservas propias
  const loadMyReservations = useCallback(async () => {
    if (!token) return;
    const from = weekStart, to = addDays(weekStart, 6);
    try {
      setMyReservations(await getMyReservations(from, to, token));
    } catch (e: any) {
      console.error("getMyReservations falló:", e?.message || e);
      setMyReservations([]);
    }
  }, [token, weekStart]);

  useEffect(() => {
    if (activeSection === 'my-reservations' && token) {
      loadMyReservations();
    }
  }, [activeSection, loadMyReservations, token]);

  // Buscar tutores
  const handleSearchTutors = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoadingSearch(true);
    setErrorSearch('');
    try {
      const result = await ApiSearchService.searchTutors(searchQuery);
      setTutors(result || []);
    } catch (err: any) {
      setErrorSearch(err?.message || 'Error realizando la búsqueda');
    } finally {
      setLoadingSearch(false);
    }
  };


  // Navegar a página de reserva
  const goToBookTutor = (tutor: TutorCard) => {
    const id = tutor.userId || (tutor as any).sub;
    if (!id) return alert('No se pudo identificar al tutor');
    navigate(`/book/${encodeURIComponent(id)}`, { state: { tutor, role: 'tutor' } });
  };

  // Cancelar reserva propia
  const cancelTutorReservation = async (id: string) => {
    if (!token) return;
    const ok = globalThis.confirm("¿Seguro que quieres cancelar esta reserva?");
    if (ok) {
      await cancelReservation(id, token);
      await loadMyReservations();
    }
  };

  // Sesión
  const handleLogout = () => { auth.removeUser(); navigate('/login'); };
  const signOutRedirect = () => {
    const clientId = "lmk8qk12er8t8ql9phit3u12e";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://us-east-1splan606f.auth.us-east-1.amazoncognito.com";
    globalThis.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };
  const handleEditProfile = () => { navigate('/edit-profile', { state: { currentRole: 'student' } }); };

  // Tareas
  const handlePostTask = () => {
    if (newTask.title && newTask.description && newTask.subject) {
      const task: Task = { id: Date.now().toString(), ...newTask, status: 'pending' };
      setTasks(prev => [...prev, task]);
      setNewTask({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' });
      alert('Tarea publicada exitosamente!');
    }
  };

  // Estilos
  const getPriorityColor = (priority: string) => ({ high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[priority] || '#6b7280');
  const getStatusColor = (status: string) => ({ completed: '#10b981', in_progress: '#3b82f6', pending: '#6b7280', ACEPTADO: '#10b981' }[status] || '#6b7280');

  if (auth.isLoading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>⏳ Verificando acceso de estudiante...</div>;
  if (!currentUser) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>🔍 Cargando información del usuario...</div>;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo"><h2>UpLearn Student</h2></div>
          <nav className="main-nav">
            <button className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}><span>📊</span> Dashboard</button>
            <button className={`nav-item ${activeSection === 'find-tutors' ? 'active' : ''}`} onClick={() => setActiveSection('find-tutors')}><span>🔍</span> Buscar Tutores</button>
            <button className={`nav-item ${activeSection === 'my-reservations' ? 'active' : ''}`} onClick={() => setActiveSection('my-reservations')}><span>🗓️</span> Mis Reservas</button>
            <button className={`nav-item ${activeSection === 'my-tasks' ? 'active' : ''}`} onClick={() => setActiveSection('my-tasks')}><span>📋</span> Mis Tareas</button>
            <button className={`nav-item ${activeSection === 'post-task' ? 'active' : ''}`} onClick={() => setActiveSection('post-task')}><span>➕</span> Publicar Tarea</button>
          </nav>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <DashboardSwitchButton currentRole="student" />
            <AddRoleButton currentRole="student" />
            <div className="user-menu-container">
              <button className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
                <span className="avatar-icon">👤</span>
                <span className="user-name">{currentUser.name}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <p className="user-email">{currentUser.email}</p>
                    <p className="user-role">Estudiante - {currentUser.educationLevel}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={handleEditProfile}><span>✏️</span> Editar Perfil</button>
                  <button className="dropdown-item" onClick={handleLogout}><span>🚪</span> Cerrar Sesión (Local)</button>
                  <button className="dropdown-item logout" onClick={signOutRedirect}><span>🔐</span> Cerrar Sesión (Cognito)</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="dashboard-main">
        {activeSection === 'dashboard' && (
          <div className="dashboard-content">
            <h1>¡Bienvenido, {currentUser.name}! 👋</h1>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon">📚</div><div className="stat-info"><h3>{tasks.length}</h3><p>Tareas Activas</p></div></div>
              <div className="stat-card"><div className="stat-icon">👨‍🏫</div><div className="stat-info"><h3>{tutors.length}</h3><p>Tutores Encontrados</p></div></div>
              <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><h3>{tasks.filter(t => t.status === 'completed').length}</h3><p>Tareas Completadas</p></div></div>
              <div className="stat-card"><div className="stat-icon">🗓️</div><div className="stat-info"><h3>{myReservations.length}</h3><p>Reservas Próximas</p></div></div>
            </div>
            <div className="recent-activity">
              <h2>Actividad Reciente</h2>
              <div className="activity-list">
                {tasks.length > 0 && (
                  <div className="activity-item">
                    <span className="activity-icon">📝</span>
                    <div className="activity-content">
                      <p><strong>Nueva tarea creada:</strong> {tasks[0]?.title}</p>
                      <small>Hace 2 horas</small>
                    </div>
                  </div>
                )}
                {myReservations.length > 0 && (
                  <div className="activity-item">
                    <span className="activity-icon">🗓️</span>
                    <div className="activity-content">
                      <p><strong>Reserva confirmada:</strong> {myReservations[0].date} a las {myReservations[0].start.slice(0, 5)}</p>
                      <small>Ayer</small>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'find-tutors' && (
          <div className="tutors-section">
            <h1>Buscar Tutores 🔍</h1>
            <section className="tutor-search">
              <form onSubmit={handleSearchTutors} className="tutor-search-form">
                <input
                  type="text"
                  placeholder="Ej: java, curso java con spring, María..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" disabled={loadingSearch}>
                  {loadingSearch ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
              {errorSearch && <p className="error">{errorSearch}</p>}
              <div className="tutor-results">
                {tutors.length === 0 && !loadingSearch && <p>No hay resultados aún. Prueba con “java”.</p>}
                {tutors.map((tutor: any) => (
                  <div key={tutor.userId || tutor.sub || tutor.email} className="tutor-card">
                    <div className="tutor-card-header">
                      <div className="tutor-title">
                        <strong className="tutor-name">{tutor.name || 'Tutor'}</strong><br />
                        <span className="tutor-email">{tutor.email}</span>
                      </div>
                    </div>

                    {tutor.bio && <p className="tutor-bio">{tutor.bio}</p>}

                    {Array.isArray(tutor.specializations) && tutor.specializations.length > 0 && (
                      <div className="tutor-tags">
                        {tutor.specializations.map((s: string, idx: number) => (
                          <span key={idx} className="tag">{s}</span>
                        ))}
                      </div>
                    )}

                    <div className="tutor-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const id = tutor.userId || tutor.sub;
                          if (!id) return alert('No se pudo identificar al tutor');
                          navigate(`/profile/tutor/${encodeURIComponent(id)}`, { state: { profile: tutor } });
                        }}
                      >
                        Ver Perfil
                      </button>

                      <button
                        className="btn-primary"
                        onClick={() => {
                          const id = tutor.userId || tutor.sub;
                          if (!id) return alert('No se pudo identificar al tutor');
                          navigate(`/book/${encodeURIComponent(id)}`, { state: { tutor, role: 'tutor' } });
                        }}
                      >
                        Reservar Cita
                      </button>
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
            <div className="card card--primary-soft reservations-panel" style={{ maxWidth: 900, margin: '20px auto', padding: '20px' }}>
              <div className="week-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <button className='btn btn-ghost' onClick={() => setWeekStart(addDays(weekStart, -7))}>&laquo; Semana Anterior</button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <strong>Semana del {weekStart} al {addDays(weekStart, 6)}</strong>
                </div>
                <button className='btn btn-ghost' onClick={() => setWeekStart(addDays(weekStart, 7))}>Siguiente Semana &raquo;</button>
              </div>

              {myReservations.length === 0 && (
        <div className="empty-note">No tienes reservas esta semana.</div>
      )}

      <div className="reservations-list">
        {myReservations.map((r) => {
          // Normalizamos estado -> color
          const s = (r.status || '').toUpperCase();
          const status =
            s.includes('CANCEL') ? { label: 'CANCELADO', color: '#ef4444', bg: 'rgba(239,68,68,.12)' } :
            s.includes('ACTIV')  ? { label: 'ACTIVA',     color: '#f59e0b', bg: 'rgba(245,158,11,.12)' } :
            s.includes('ACEPT') || s.includes('CONFIRM')
                                 ? { label: 'CONFIRMADA', color: '#10b981', bg: 'rgba(16,185,129,.12)' } :
                                   { label: r.status || '—', color: '#6b7280', bg: 'rgba(107,114,128,.12)' };

          const tutorName = r.tutorName && r.tutorName.trim() ? r.tutorName : 'Tutor';

          return (
            <article key={r.id} className="reservation-card" tabIndex={0}>
              <header className="reservation-card__header">
                <h3 className="reservation-card__title">
                  Reserva con {tutorName}
                </h3>
                <span
                  className="status-pill"
                  style={{ color: status.color, background: status.bg }}
                >
                  {status.label}
                </span>
              </header>

              <div className="reservation-card__meta">
                <span>🗓️ {r.date}</span>
                <span>⏰ {r.start.slice(0, 5)} – {r.end.slice(0, 5)}</span>
              </div>

              <div className="reservation-card__actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => cancelTutorReservation(r.id)}
                >
                  Cancelar
                </button>
              </div>
            </article>
          );
        })}

      </div>
    </div>
          </div>)}

        {activeSection === 'my-tasks' && (
          <div className="tasks-section">
            <h1>Mis Tareas 📋</h1>
            <div className="tasks-grid">
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <div className="task-meta">
                      <span className="priority-badge" style={{ backgroundColor: getPriorityColor(task.priority) }}>
                        {task.priority.toUpperCase()}
                      </span>
                      <span className="status-badge" style={{ color: getStatusColor(task.status) }}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="task-description">{task.description}</p>
                  <div className="task-details">
                    <span className="task-subject">📚 {task.subject}</span>
                    <span className="task-due-date">📅 {task.dueDate}</span>
                  </div>
                  <div className="task-actions">
                    <button className="btn-primary">Ver Detalles</button>
                    <button className="btn-secondary">Editar</button>
                  </div>
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
                <div className="form-group">
                  <label>Título de la Tarea</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Ej: Ayuda con ejercicios de cálculo"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Describe detalladamente lo que necesitas..."
                    className="form-textarea"
                    rows={4}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Materia</label>
                    <select
                      value={newTask.subject}
                      onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                      className="form-select"
                    >
                      <option value="">Seleccionar materia</option>
                      {subjects.map(subject => (<option key={subject} value={subject}>{subject}</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha Límite</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Prioridad</label>
                  <div className="priority-options">
                    {['low', 'medium', 'high'].map(priority => (
                      <label key={priority} className="priority-option">
                        <input
                          type="radio"
                          name="priority"
                          value={priority}
                          checked={newTask.priority === priority}
                          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                        />
                        <span className="priority-label" style={{ color: getPriorityColor(priority) }}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-primary btn-large" onClick={handlePostTask}>Publicar Tarea</button>
                  <button
                    className="btn-secondary"
                    onClick={() => setNewTask({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' })}
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

export default StudentDashboard;
