import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import '../styles/RegisterPageCognito.css';
import { getUserAuthInfo } from '../utils/tokenUtils';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  // Configuración de Cognito para registro
  const cognitoConfig = {
    clientId: "lmk8qk12er8t8ql9phit3u12e",
    cognitoDomain: "https://us-east-1splan606f.auth.us-east-1.amazoncognito.com",
    redirectUri: "http://localhost:3000"
  };

  // Función para redirigir al registro de Cognito
  const redirectToCognitoSignUp = () => {
    const { clientId, cognitoDomain, redirectUri } = cognitoConfig;
    const signUpUrl = `${cognitoDomain}/signup?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('🔗 Redirigiendo al registro de Cognito:', signUpUrl);
    window.location.href = signUpUrl;
  };

  // Verificar si el usuario ya está autenticado
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const { redirectPath } = getUserAuthInfo(auth.user);
      console.log('✅ Usuario ya autenticado, redirigiendo a:', redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [auth.isAuthenticated, auth.user, navigate]);

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  // Mostrar estado de carga
  if (auth.isLoading) {
    return (
      <div className="register-container">
        <div className="register-content">
          <div className="loading-state">
            <h2>⏳ Verificando estado de autenticación...</h2>
            <p>Por favor espera un momento...</p>
          </div>
        </div>
      </div>
    );
  }

  // Si ya está autenticado, mostrar mensaje
  if (auth.isAuthenticated) {
    return (
      <div className="register-container">
        <div className="register-content">
          <div className="authenticated-state">
            <h2> Ya tienes una sesión activa</h2>
            <p>Email: {auth.user?.profile?.email}</p>
            <p>Redirigiendo a tu dashboard...</p>
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const { redirectPath } = getUserAuthInfo(auth.user);
                  navigate(redirectPath);
                }}
              >
                Ir al Dashboard
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => auth.removeUser()}
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Página principal de registro con redirección a Cognito
  return (
    <div className="register-container">
      <div className="register-content">
        <div className="register-header">
          <h1 className="register-title">🎓 Crear Cuenta en UpLearn</h1>
          <p className="register-subtitle">
            Únete a nuestra comunidad educativa con AWS Cognito
          </p>
        </div>

        <div className="cognito-register-section">
          <div className="feature-highlights">
            <div className="feature-item">
              <div className="feature-content">
                <h3>Seguridad Avanzada</h3>
                <p>Tu cuenta estará protegida con AWS Cognito, la solución de autenticación más segura</p>
              </div>
            </div>
          </div>

          <div className="cognito-action-section">
            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-primary cognito-register-btn" 
                onClick={redirectToCognitoSignUp}
              >
                 Crear Cuenta con Cognito
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

        <div className="register-footer">
          <p>
            ¿Ya tienes una cuenta? 
            <button className="link-button" onClick={handleGoToLogin}>
              Inicia sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;