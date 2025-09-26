import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiUserService from '../service/Api-user';
import '../styles/LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const [errors, setErrors] = useState({
    username: '',
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
      username: '',
      password: '',
      general: ''
    };

    if (!formData.username.trim()) {
      newErrors.username = 'El usuario es requerido';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return !newErrors.username && !newErrors.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));

    try {
      const response = await ApiUserService.login(formData.username, formData.password);
      
      if (response.success) {
        // Login exitoso
        alert(`¡Bienvenido ${response.user.name}!`);
        
        // Redirigir según el rol del usuario
        const currentUser = ApiUserService.getCurrentUser();
        if (currentUser?.role === 'STUDENT') {
          // Redirigir a dashboard de estudiante (por ahora a home)
          navigate('/');
        } else if (currentUser?.role === 'TUTOR') {
          // Redirigir a dashboard de tutor (por ahora a home)
          navigate('/');
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
            <label htmlFor="username" className="form-label">
              Usuario
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className={`form-input ${errors.username ? 'error' : ''}`}
              placeholder="Ingresa tu usuario"
              value={formData.username}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            {errors.username && (
              <span className="error-message">{errors.username}</span>
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