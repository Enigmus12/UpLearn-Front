import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import './App.css';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import TutorDashboard from './pages/TutorDashboard';
import EditProfilePage from './pages/EditProfilePage';
import { getUserAuthInfo } from './utils/tokenUtils';
import ReservationPage from './pages/ReservationPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ 
  children, 
  allowedRoles 
}) => {
  const auth = useAuth();
  
  console.log('🛡️ ProtectedRoute check:', { 
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    allowedRoles,
    hasUser: !!auth.user
  });
  
  if (auth.isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        ⏳ Verificando permisos...
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    console.log(' Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const { role } = getUserAuthInfo(auth.user);
    console.log(' User role:', role, 'Allowed roles:', allowedRoles);
    
    if (!role || !allowedRoles.includes(role)) {
      console.log(' Role not allowed, redirecting to home');
      return <Navigate to="/" replace />;
    }
  }

  console.log(' Access granted');
  return <>{children}</>;
};

// Auth Redirect Component
const AuthRedirect: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log(' AuthRedirect useEffect:', { 
      isAuthenticated: auth.isAuthenticated, 
      isLoading: auth.isLoading,
      hasUser: !!auth.user 
    });

    if (auth.isAuthenticated && auth.user && !auth.isLoading) {
      const { redirectPath } = getUserAuthInfo(auth.user);
      console.log(' Redirecting to:', redirectPath);
      
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 100);
    }
  }, [auth.isAuthenticated, auth.user, auth.isLoading, navigate]);

  if (auth.isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        ⏳ Cargando autenticación...
      </div>
    );
  }

  if (auth.error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px'
      }}>
        <div> Error de autenticación: {auth.error.message}</div>
        <button onClick={() => auth.signinRedirect()}>
          Intentar nuevamente
        </button>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage />;
  }

  // Show while redirecting
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      gap: '20px'
    }}>
      <div> ¡Autenticación exitosa!</div>
      <div> Redirigiendo al dashboard...</div>
      <button 
        onClick={() => {
          const { redirectPath } = getUserAuthInfo(auth.user);
          navigate(redirectPath, { replace: true });
        }}
        style={{
          padding: '10px 20px',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Ir manualmente al dashboard
      </button>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthRedirect />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route 
            path="/student-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tutor-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <TutorDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/edit-profile" 
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route path="/reservar/:tutorId" element={<ReservationPage />} /> 
        </Routes>
      </div>
    </Router>
  );
};

export default App;