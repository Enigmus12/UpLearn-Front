import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  const handleRegister = () => {
    navigate('/register');
  };

  return (
    <div className="home-container">
      <div className="content">
        <h1 className="title">Bienvenido a UpLearn</h1>
        <p className="subtitle">Tu plataforma de aprendizaje online</p>
        
        <div className="buttons-container">
          <button 
            className="btn btn-login" 
            onClick={handleLogin}
          >
            Iniciar Sesión
          </button>
          
          <button 
            className="btn btn-register" 
            onClick={handleRegister}
          >
            Registrarse
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;