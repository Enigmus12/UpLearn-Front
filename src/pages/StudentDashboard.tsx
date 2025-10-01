import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import '../styles/StudentDashboard.css';
import { useAuthFlow } from '../utils/useAuthFlow';
// import { useCognitoIntegration } from '../utils/useCognitoIntegration'; // COMENTADO: Ya no necesario
import ApiSearchService from '../service/Api-search';
import DashboardSwitchButton from '../components/DashboardSwitchButton';
import AddRoleButton from '../components/AddRoleButton';

interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  educationLevel?: string;
}

interface Tutor {
  userId: string;
  name: string;
  bio: string;
  specializations: string[];
  credentials: string[];
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

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { userRoles, isAuthenticated } = useAuthFlow();
  
  // COMENTADO: Hook para manejar la integración con Cognito (ya no necesario con useAuthFlow)
  // const { isProcessing, processingError, isProcessed } = useCognitoIntegration();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'find-tutors' | 'my-tasks' | 'post-task'>('dashboard');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const subjects = ['Matemáticas', 'Física', 'Química', 'Programación', 'Inglés', 'Historia', 'Biología'];

  const [search, setSearch] = useState<string>('');
  const [tutors, setTutors] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [errorSearch, setErrorSearch] = useState<string>('');

  // esto vendrá del backend
  
  const handleSearchTutors = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSearch(true);
    setErrorSearch('');
    try {
      // Antes: const result = await ApiUserService.searchTutors(search);
      const result = await ApiSearchService.searchTutors(search);
      setTutors(result || []);
    } catch (err: any) {
      setErrorSearch(err?.message || 'Error realizando la búsqueda');
    } finally {
      setLoadingSearch(false);
    }
  };

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Tarea de Cálculo',
      description: 'Resolver ejercicios de derivadas',
      subject: 'Matemáticas',
      dueDate: '2025-10-01',
      priority: 'high',
      status: 'pending'
    },
    {
      id: '2',
      title: 'Proyecto de Programación',
      description: 'Crear una aplicación web con React',
      subject: 'Programación',
      dueDate: '2025-10-05',
      priority: 'medium',
      status: 'in_progress'
    }
  ]);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    subject: '',
    dueDate: '',
    priority: 'medium' as const
  });

  useEffect(() => {
    // Solo proceder si tenemos información completa del usuario
    if (isAuthenticated === null || userRoles === null) {
      return;
    }

    // Verificar si el usuario está autenticado y es estudiante usando Cognito
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!userRoles || !userRoles.includes('student')) {
      navigate('/');
      return;
    }

    // Obtener datos del usuario desde Cognito
    if (auth.user) {
      setCurrentUser({
        userId: auth.user.profile?.sub || 'unknown',
        name: auth.user.profile?.name || auth.user.profile?.nickname || 'Usuario',
        email: auth.user.profile?.email || 'No email',
        role: 'student'
      });
    }
  }, [isAuthenticated, userRoles, navigate, auth.user]);

  const handleLogout = () => {
    // Logout usando Cognito
    auth.removeUser();
    navigate('/login');
  };

  const signOutRedirect = () => {
    const clientId = "lmk8qk12er8t8ql9phit3u12e";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://us-east-1splan606f.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleEditProfile = () => {
    navigate('/edit-profile', { state: { currentRole: 'student' } });
  };

  const handlePostTask = () => {
    if (newTask.title && newTask.description && newTask.subject) {
      const task: Task = {
        id: Date.now().toString(),
        ...newTask,
        status: 'pending'
      };
      setTasks([...tasks, task]);
      setNewTask({ title: '', description: '', subject: '', dueDate: '', priority: 'medium' });
      setShowTaskModal(false);
      alert('Tarea publicada exitosamente!');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  if (auth.isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        ⏳ Verificando acceso de estudiante...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        🔍 Cargando información del usuario...
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <h2>UpLearn Student</h2>
          </div>
          
          <nav className="main-nav">
            <button 
              className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveSection('dashboard')}
            >
              <span>📊</span> Dashboard
            </button>
            <button 
              className={`nav-item ${activeSection === 'find-tutors' ? 'active' : ''}`}
              onClick={() => setActiveSection('find-tutors')}
            >
              <span>🔍</span> Buscar Tutores
            </button>
            <button 
              className={`nav-item ${activeSection === 'my-tasks' ? 'active' : ''}`}
              onClick={() => setActiveSection('my-tasks')}
            >
              <span>📋</span> Mis Tareas
            </button>
            <button 
              className={`nav-item ${activeSection === 'post-task' ? 'active' : ''}`}
              onClick={() => setActiveSection('post-task')}
            >
              <span>➕</span> Publicar Tarea
            </button>
          </nav>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <DashboardSwitchButton currentRole="student" />
            <AddRoleButton currentRole="student" />
            
            <div className="user-menu-container">
            <button 
              className="user-avatar"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
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
                <button className="dropdown-item" onClick={handleEditProfile}>
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
        {/* Dashboard Overview */}
        {activeSection === 'dashboard' && (
          <div className="dashboard-content">
            <h1>¡Bienvenido, {currentUser.name}! 👋</h1>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <h3>{tasks.length}</h3>
                  <p>Tareas Activas</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">👨‍🏫</div>
                <div className="stat-info">
                  <h3>{tutors.length}</h3>
                  <p>Tutores Disponibles</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h3>{tasks.filter(t => t.status === 'completed').length}</h3>
                  <p>Tareas Completadas</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⏰</div>
                <div className="stat-info">
                  <h3>{tasks.filter(t => t.status === 'pending').length}</h3>
                  <p>Tareas Pendientes</p>
                </div>
              </div>
            </div>

            <div className="recent-activity">
              <h2>Actividad Reciente</h2>
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-icon">📝</span>
                  <div className="activity-content">
                    <p><strong>Nueva tarea creada:</strong> {tasks[0]?.title}</p>
                    <small>Hace 2 horas</small>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">👨‍🏫</span>
                  <div className="activity-content">
                    <p><strong>Tutor contactado:</strong> Dr. María González</p>
                    <small>Ayer</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Find Tutors Section */}
        {activeSection === 'find-tutors' && (
        <div className="tutors-section">
          <h1>Buscar Tutores 🔍</h1>

          <section className="tutor-search">
            <h2>Buscar tutores</h2>
            <form onSubmit={handleSearchTutors} className="tutor-search-form">
              <input
                type="text"
                placeholder="Ej: java, curso java con spring, María..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" disabled={loadingSearch}>
                {loadingSearch ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {errorSearch && <p className="error">{errorSearch}</p>}

            <div className="tutor-results">
              {tutors.length === 0 && !loadingSearch && (
                <p>No hay resultados aún. Prueba con “java”.</p>
              )}

              {tutors.map((tutor: any) => (
                <div key={tutor.sub || tutor.userId || tutor.email} className="tutor-card">
                  <div className="tutor-card-header">
                    <div className="tutor-title">
                      <strong className="tutor-name">{tutor.name || 'Tutor'}</strong>
                      <br></br>
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
                </div>
              ))}

            </div>
          </section>
        </div>
      )}



        {/* My Tasks Section */}
        {activeSection === 'my-tasks' && (
          <div className="tasks-section">
            <h1>Mis Tareas 📋</h1>
            
            <div className="tasks-grid">
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <div className="task-meta">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(task.priority) }}
                      >
                        {task.priority.toUpperCase()}
                      </span>
                      <span 
                        className="status-badge"
                        style={{ color: getStatusColor(task.status) }}
                      >
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

        {/* Post Task Section */}
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
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Ej: Ayuda con ejercicios de cálculo"
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
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
                      onChange={(e) => setNewTask({...newTask, subject: e.target.value})}
                      className="form-select"
                    >
                      <option value="">Seleccionar materia</option>
                      {subjects.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Fecha Límite</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
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
                          onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                        />
                        <span className="priority-label" style={{ color: getPriorityColor(priority) }}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    className="btn-primary btn-large"
                    onClick={handlePostTask}
                  >
                    Publicar Tarea
                  </button>
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