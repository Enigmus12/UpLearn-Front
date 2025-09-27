import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiUserService from '../service/Api-user';
import '../styles/StudentDashboard.css';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'find-tutors' | 'my-tasks' | 'post-task'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);

  // esto vendrá del backend
  const [tutors] = useState<Tutor[]>([
    {
      userId: 'tutor1',
      name: 'Dr. María González',
      bio: 'Profesora de Matemáticas con 10 años de experiencia',
      specializations: ['Matemáticas', 'Cálculo', 'Álgebra'],
      credentials: ['PhD en Matemáticas', 'Profesora Universitaria'],
      rating: 4.8,
      hourlyRate: 25000
    },
    {
      userId: 'tutor2', 
      name: 'Prof. Carlos Rodríguez',
      bio: 'Experto en programación y desarrollo de software',
      specializations: ['Programación', 'JavaScript', 'Python'],
      credentials: ['Ingeniero de Software', 'Certificación AWS'],
      rating: 4.9,
      hourlyRate: 30000
    },
    {
      userId: 'tutor3',
      name: 'Dra. Ana Martínez',
      bio: 'Especialista en ciencias naturales y química',
      specializations: ['Química', 'Física', 'Biología'],
      credentials: ['PhD en Química', 'Investigadora'],
      rating: 4.7,
      hourlyRate: 28000
    }
  ]);

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
    // Verificar si el usuario está autenticado y es estudiante
    const user = ApiUserService.getCurrentUser();
    if (!user || user.role !== 'STUDENT') {
      navigate('/login');
      return;
    }

    // Obtener datos del usuario desde el token o backend
    // Por ahora usamos datos mock
    setCurrentUser({
      userId: user.userId,
      name: 'Juan Estudiante', // obtener del backend
      email: 'juan@estudiante.com',
      role: user.role,
      educationLevel: 'Pregrado'
    });
  }, [navigate]);

  const handleLogout = () => {
    ApiUserService.logout();
    navigate('/login');
  };

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  const filteredTutors = tutors.filter(tutor => {
    const matchesSearch = tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tutor.specializations.some(spec => spec.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === '' || tutor.specializations.includes(selectedSubject);
    return matchesSearch && matchesSubject;
  });

  const subjects = ['Matemáticas', 'Física', 'Química', 'Programación', 'Inglés', 'Historia', 'Biología'];

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

  if (!currentUser) {
    return <div className="loading">Cargando...</div>;
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
                <button className="dropdown-item logout" onClick={handleLogout}>
                  <span>🚪</span> Cerrar Sesión
                </button>
              </div>
            )}
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
            
            <div className="search-filters">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Buscar por nombre o especialización..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="subject-filter"
              >
                <option value="">Todas las materias</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div className="tutors-grid">
              {filteredTutors.map(tutor => (
                <div key={tutor.userId} className="tutor-card">
                  <div className="tutor-header">
                    <div className="tutor-avatar">👨‍🏫</div>
                    <div className="tutor-info">
                      <h3>{tutor.name}</h3>
                      <div className="rating">
                        <span>⭐ {tutor.rating}</span>
                        <span className="hourly-rate">${tutor.hourlyRate?.toLocaleString()}/hora</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="tutor-bio">{tutor.bio}</p>
                  
                  <div className="specializations">
                    {tutor.specializations.map(spec => (
                      <span key={spec} className="specialization-tag">{spec}</span>
                    ))}
                  </div>
                  
                  <div className="tutor-actions">
                    <button className="btn-primary">Contactar</button>
                    <button className="btn-secondary">Ver Perfil</button>
                  </div>
                </div>
              ))}
            </div>
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