import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import '../styles/LoginPage.css';
import { getUserAuthInfo } from '../utils/tokenUtils';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  // Función de redirección de cierre de sesión para Cognito
  const signOutRedirect = () => {
    const clientId = "lmk8qk12er8t8ql9phit3u12e";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://us-east-1splan606f.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  // Verificar el estado de autenticación y redirigir si ya ha iniciado sesión
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const { redirectPath } = getUserAuthInfo(auth.user);
      navigate(redirectPath, { replace: true });
    }
  }, [auth.isAuthenticated, auth.user, navigate]);

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleGoToRegister = () => {
    navigate('/register');
  };

  // Mostrar estado de carga
  if (auth.isLoading) {
    return (
      <div className="login-container">
        <div className="login-content">
          <div className="loading-state">
            <h2>Cargando...</h2>
            <p>Verificando estado de autenticación...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar estado de error
  if (auth.error) {
    return (
      <div className="login-container">
        <div className="login-content">
          <div className="error-state">
            <h2>Error de Autenticación</h2>
            <p>Ocurrió un error: {auth.error.message}</p>
            <button 
              className="btn btn-primary" 
              onClick={() => auth.signinRedirect()}
            >
              Intentar de Nuevo
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleBackToHome}
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar estado de autenticación (esto activará la redirección a través de useEffect)
  if (auth.isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-content">
          <div className="authenticated-state">
            <h2>¡Bienvenido!</h2>
            <p>Sesión iniciada como: {auth.user?.profile?.email}</p>
            <p>Redirigiendo...</p>
            <div className="form-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => auth.removeUser()}
              >
                Cerrar Sesión
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => signOutRedirect()}
              >
                Cerrar Sesión (Cognito)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar formulario de inicio de sesión para usuarios no autenticados
  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-header">
          <h1 className="login-title">Iniciar Sesión</h1>
          <p className="login-subtitle">Accede a tu cuenta de UpLearn con AWS Cognito</p>
        </div>

        <div className="login-form">
          <div className="cognito-login-section">
            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-primary cognito-login-btn" 
                onClick={() => auth.signinRedirect()}
              >
                Iniciar Sesión con Cognito
              </button>
              
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleBackToHome}
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>

        <div className="login-footer">
          <p>¿No tienes una cuenta? <a href="#" className="link" onClick={handleGoToRegister}>Regístrate aquí</a></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;