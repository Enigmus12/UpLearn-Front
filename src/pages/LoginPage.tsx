import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiUserService from '../service/Api-user';
import '../styles/LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    userId: '',
    password: ''
  });

  const [errors, setErrors] = useState({
    userId: '',
    password: '',
    general: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar errores cuando el usuario empiece a escribir
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {
      userId: '',
      password: '',
      general: ''
    };

    if (!formData.userId.trim()) {
      newErrors.userId = 'El ID de usuario es requerido';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return !newErrors.userId && !newErrors.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));

    try {
      const response = await ApiUserService.login(formData.userId, formData.password);
      
      // { authenticated, user, token, message }
      if (response.authenticated) {
        // Login exitoso
        alert(`¡Bienvenido ${response.user.name}!`);
        
        // Redirigir según el rol del usuario desde la respuesta
        if (response.user.role === 'STUDENT') {
          // Redirigir a dashboard de estudiante
          navigate('/student-dashboard');
        } else if (response.user.role === 'TUTOR') {
          // Redirigir a dashboard de tutor
          navigate('/tutor-dashboard');
        } else {
          navigate('/');
        }
      } else {
        // Login fallido
        setErrors(prev => ({ 
          ...prev, 
          general: response.message || 'Credenciales incorrectas'
        }));
      }
    } catch (error) {
      console.error('Error en login:', error);
      setErrors(prev => ({ 
        ...prev, 
        general: error instanceof Error ? error.message : 'Error de conexión'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleGoToRegister = () => {
    navigate('/register');
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-header">
          <h1 className="login-title">Iniciar Sesión</h1>
          <p className="login-subtitle">Accede a tu cuenta de UpLearn</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="alert alert-error">
              {errors.general}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="userId" className="form-label">
              ID de Usuario
            </label>
            <input
              type="text"
              id="userId"
              name="userId"
              className={`form-input ${errors.userId ? 'error' : ''}`}
              placeholder="Ingresa tu ID de usuario"
              value={formData.userId}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            {errors.userId && (
              <span className="error-message">{errors.userId}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Ingresa tu contraseña"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleBackToHome}
              disabled={isLoading}
            >
              Volver al Inicio
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>¿No tienes una cuenta? <a href="#" className="link" onClick={handleGoToRegister}>Regístrate aquí</a></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;