import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import '../styles/TutorDashboard.css';
import { useAuthFlow } from '../utils/useAuthFlow';
import DashboardSwitchButton from '../components/DashboardSwitchButton';
import AddRoleButton from '../components/AddRoleButton';
import TutorAvailabilityPage from './TutorAvailabilityPage';
import TutorClassesPage from './TutorClassesPage';

/**
 * Componente reutilizable para la navegación superior del tutor.
 */
export const TutorTopNav: React.FC<{ currentRole?: 'tutor' | 'student' }> = ({ currentRole = 'tutor' }) => {
  return (
    <>
      <DashboardSwitchButton currentRole={currentRole} />
      <AddRoleButton currentRole={currentRole} />
    </>
  );
};

// Tipos locales
interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  bio?: string;
  specializations?: string[];
  credentials?: string[];
}
interface TutoringRequest {
  id: string;
  studentName: string;
  subject: string;
  description: string;
  requestDate: string;
  status: 'pending' | 'accepted' | 'rejected';
  priority: 'low' | 'medium' | 'high';
}
interface TutoringSession {
  id: string;
  title: string;
  description: string;
  subject: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  maxStudents: number;
  enrolledStudents: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

const TutorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { userRoles, isAuthenticated } = useAuthFlow();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'requests' | 'availability' | 'sessions' | 'create-session'>('dashboard');

  // Datos simulados de UI
  const [requests, setRequests] = useState<TutoringRequest[]>([
    { id: '1', studentName: 'María López', subject: 'Matemáticas', description: 'Necesito ayuda con cálculo integral', requestDate: '2025-09-25', status: 'pending', priority: 'high' },
    { id: '2', studentName: 'Pedro Ruiz', subject: 'Programación', description: 'Ayuda con React y TypeScript', requestDate: '2025-09-24', status: 'pending', priority: 'medium' },
    { id: '3', studentName: 'Sofia Cruz', subject: 'Física', description: 'Problemas de cinemática', requestDate: '2025-09-23', status: 'accepted', priority: 'low' },
  ]);
  const [sessions, setSessions] = useState<TutoringSession[]>([
    { id: '1', title: 'Introducción al Cálculo', description: 'Conceptos básicos de límites y derivadas', subject: 'Matemáticas', date: '2025-09-28', time: '14:00', duration: 60, price: 25000, maxStudents: 5, enrolledStudents: 3, status: 'scheduled' },
    { id: '2', title: 'React Avanzado', description: 'Hooks personalizados y optimización', subject: 'Programación', date: '2025-09-30', time: '16:00', duration: 90, price: 35000, maxStudents: 8, enrolledStudents: 6, status: 'scheduled' },
  ]);
  const [newSession, setNewSession] = useState({
    title: '', description: '', subject: '', date: '', time: '', duration: 60, price: 25000, maxStudents: 5
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!userRoles || !userRoles.includes('tutor')) {
      navigate('/');
      return;
    }
    if (auth.user) {
      setCurrentUser({
        userId: auth.user.profile?.sub || 'unknown',
        name: auth.user.profile?.name || auth.user.profile?.nickname || 'Tutor',
        email: auth.user.profile?.email || 'No email',
        role: userRoles?.includes('tutor') ? 'tutor' : 'unknown',
        bio: 'Tutor profesional en UpLearn',
        specializations: ['Matemáticas', 'Cálculo', 'Álgebra'],
        credentials: ['Profesional Certificado']
      });
    }
  }, [isAuthenticated, userRoles, navigate, auth.user]);

  const handleLogout = () => {
    auth.removeUser();
    navigate('/login');
  };
  const signOutRedirect = () => {
    const clientId = "lmk8qk12er8t8ql9phit3u12e";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://us-east-1splan606f.auth.us-east-1.amazoncognito.com";
    globalThis.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };
  const handleEditProfile = () => {
    navigate('/edit-profile', { state: { currentRole: 'tutor' } });
  };

  const handleAcceptRequest = (requestId: string) => {
    setRequests(prev => prev.map(req => (req.id === requestId ? { ...req, status: 'accepted' } : req)));
    alert('Solicitud aceptada. El estudiante será notificado.');
  };
  const handleRejectRequest = (requestId: string) => {
    setRequests(prev => prev.map(req => (req.id === requestId ? { ...req, status: 'rejected' } : req)));
    alert('Solicitud rechazada.');
  };
  const handleCreateSession = () => {
    if (newSession.title && newSession.subject && newSession.date && newSession.time) {
      const session: TutoringSession = {
        id: Date.now().toString(),
        ...newSession,
        enrolledStudents: 0,
        status: 'scheduled'
      };
      setSessions(s => [...s, session]);
      setNewSession({ title: '', description: '', subject: '', date: '', time: '', duration: 60, price: 25000, maxStudents: 5 });
      alert('Sesión de tutoría creada exitosamente!');
    }
  };

  const getPriorityColor = (priority: string) => ({ high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[priority] || '#6b7280');
  const getStatusColor = (status: string) => ({
    accepted: '#10b981',
    rejected: '#ef4444',
    pending: '#f59e0b',
    active: '#10b981',
    inactive: '#6b7280',
    scheduled: '#3b82f6',
    completed: '#10b981',
    cancelled: '#ef4444'
  }[status] || '#6b7280');

  if (auth.isLoading) return <div className="full-center">⏳ Verificando acceso de tutor...</div>;
  if (!currentUser) return <div className="full-center">🔍 Cargando información del tutor...</div>;

  return (
    <div className="tutor-dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <h2>UpLearn Tutor</h2>
          </div>

          <nav className="main-nav">
            <button className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}><span>📊</span> Dashboard</button>
            <button className={`nav-item ${activeSection === 'requests' ? 'active' : ''}`} onClick={() => setActiveSection('requests')}><span>📬</span> Solicitudes</button>
            <button className={`nav-item ${activeSection === 'availability' ? 'active' : ''}`} onClick={() => setActiveSection('availability')}><span>🗓️</span> Disponibilidad</button>
            <button className={`nav-item ${activeSection === 'sessions' ? 'active' : ''}`} onClick={() => setActiveSection('sessions')}><span>🎓</span> Mis Clases</button>
            <button className={`nav-item ${activeSection === 'create-session' ? 'active' : ''}`} onClick={() => setActiveSection('create-session')}><span>➕</span> Nueva Clase</button>
          </nav>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TutorTopNav currentRole="tutor" />
            <div className="user-menu-container">
              <button className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
                <span className="avatar-icon">👨‍🏫</span>
                <span className="user-name">{currentUser.name}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <p className="user-email">{currentUser.email}</p>
                    <p className="user-role">Tutor Profesional</p>
                    <small style={{ color: '#666', fontSize: '0.8rem' }}>Autenticado con AWS Cognito</small>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      <span style={{ color: '#10b981' }}>✅ Conectado</span>
                    </div>
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

      <main className="dashboard-main">
        {activeSection === 'dashboard' && (
          <div className="dashboard-content">
            <h1>¡Bienvenido, {currentUser.name}! 👨‍🏫</h1>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📬</div>
                <div className="stat-info"><h3>{requests.filter(r => r.status === 'pending').length}</h3><p>Solicitudes Pendientes</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎓</div>
                <div className="stat-info"><h3>{sessions.filter(s => s.status === 'scheduled').length}</h3><p>Clases Programadas</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info"><h3>{sessions.reduce((acc, s) => acc + (s.price * s.enrolledStudents), 0).toLocaleString()}</h3><p>Ingresos Estimados</p></div>
              </div>
            </div>
            <div className="recent-activity">
              <h2>Actividad Reciente</h2>
              <div className="activity-list">
                <div className="activity-item"><span className="activity-icon">📝</span><div className="activity-content"><p><strong>Nueva solicitud:</strong> {requests[0]?.studentName} - {requests[0]?.subject}</p><small>Hace 1 hora</small></div></div>
                <div className="activity-item"><span className="activity-icon">✅</span><div className="activity-content"><p><strong>Sesión completada:</strong> Introducción al Cálculo</p><small>Ayer</small></div></div>
              </div>
            </div>
          </div>
        )}
        {activeSection === 'requests' && (
          <div className="requests-section">
            <h1>Solicitudes de Tutoría 📬</h1>
            <div className="requests-grid">
              {requests.map(request => (
                <div key={request.id} className="request-card">
                  <div className="request-header"><h3>{request.studentName}</h3><div className="request-meta"><span className="priority-badge" style={{ backgroundColor: getPriorityColor(request.priority) }}>{request.priority.toUpperCase()}</span><span className="status-badge" style={{ color: getStatusColor(request.status) }}>{request.status === 'pending' ? 'PENDIENTE' : request.status === 'accepted' ? 'ACEPTADA' : 'RECHAZADA'}</span></div></div>
                  <div className="request-content"><p><strong>Materia:</strong> {request.subject}</p><p><strong>Descripción:</strong> {request.description}</p><p><strong>Fecha:</strong> {request.requestDate}</p></div>
                  {request.status === 'pending' && (<div className="request-actions"><button className="btn-primary" onClick={() => handleAcceptRequest(request.id)}>Aceptar</button><button className="btn-danger" onClick={() => handleRejectRequest(request.id)}>Rechazar</button></div>)}
                </div>
              ))}
            </div>
          </div>
        )}
        {activeSection === 'availability' && <TutorAvailabilityPage />}
        {activeSection === 'sessions' && <TutorClassesPage />}
        {activeSection === 'create-session' && (
          <div className="create-session-section">
            <h1>Crear Nueva Clase ➕</h1>
            <div className="session-form-container">
              <div className="session-form">
                <div className="form-group"><label htmlFor="session-title">Título de la Clase</label><input id="session-title" type="text" value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} placeholder="Ej: Introducción al Cálculo Diferencial" className="form-input"/></div>
                <div className="form-group"><label htmlFor="session-description">Descripción</label><textarea id="session-description" value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} placeholder="Describe los temas que se cubrirán..." className="form-textarea" rows={3}/></div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="session-subject">Materia</label><select id="session-subject" value={newSession.subject} onChange={(e) => setNewSession({ ...newSession, subject: e.target.value })} className="form-select"><option value="">Seleccionar materia</option><option value="Matemáticas">Matemáticas</option><option value="Física">Física</option><option value="Química">Química</option><option value="Programación">Programación</option><option value="Inglés">Inglés</option></select></div>
                  <div className="form-group"><label htmlFor="session-date">Fecha</label><input id="session-date" type="date" value={newSession.date} onChange={(e) => setNewSession({ ...newSession, date: e.target.value })} className="form-input"/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="session-time">Hora</label><input id="session-time" type="time" value={newSession.time} onChange={(e) => setNewSession({ ...newSession, time: e.target.value })} className="form-input"/></div>
                  <div className="form-group"><label htmlFor="session-duration">Duración (minutos)</label><select id="session-duration" value={newSession.duration} onChange={(e) => setNewSession({ ...newSession, duration: Number.parseInt(e.target.value) })} className="form-select"><option value={30}>30 minutos</option><option value={60}>1 hora</option><option value={90}>1.5 horas</option><option value={120}>2 horas</option></select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="session-price">Precio ($)</label><input id="session-price" type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: Number.parseInt(e.target.value) })} className="form-input" min="10000" step="5000"/></div>
                  <div className="form-group"><label htmlFor="max-students">Máximo de Estudiantes</label><select id="max-students" value={newSession.maxStudents} onChange={(e) => setNewSession({ ...newSession, maxStudents: Number.parseInt(e.target.value) })} className="form-select"><option value={1}>1 estudiante</option><option value={3}>3 estudiantes</option><option value={5}>5 estudiantes</option><option value={8}>8 estudiantes</option><option value={10}>10 estudiantes</option></select></div>
                </div>
                <div className="form-actions"><button className="btn-primary btn-large" onClick={handleCreateSession}>Crear Clase</button><button className="btn-secondary" onClick={() => setNewSession({ title: '', description: '', subject: '', date: '', time: '', duration: 60, price: 25000, maxStudents: 5 })}>Limpiar</button></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TutorDashboard;