import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ProfileIncompleteNotification.css';

interface ProfileIncompleteNotificationProps {
  missingFields: string[];
  currentRole: string;
  onDismiss?: () => void;
}

const ProfileIncompleteNotification: React.FC<ProfileIncompleteNotificationProps> = ({
  missingFields,
  currentRole,
  onDismiss
}) => {
  const navigate = useNavigate();

  console.log('🔔 ProfileIncompleteNotification: Renderizando con:', {
    missingFields,
    currentRole,
    hasMissingFields: missingFields && missingFields.length > 0
  });

  const handleCompleteProfile = () => {
    navigate('/edit-profile', { state: { currentRole } });
  };

  const fieldLabels: Record<string, string> = {
    name: 'Nombre',
    email: 'Email',
    phoneNumber: 'Teléfono',
    idType: 'Tipo de Identificación',
    idNumber: 'Número de Identificación',
    educationLevel: 'Nivel Educativo',
    bio: 'Biografía',
    specializations: 'Especializaciones',
    credentials: 'Credenciales'
  };

  return (
    <div className="profile-incomplete-notification">
      <div className="notification-content">
        <div className="notification-text">
          <h3>Perfil Incompleto</h3>
          <p>Por favor completa tu perfil para aprovechar todas las funcionalidades.</p>
        </div>
        <div className="notification-actions">
                      {onDismiss && (
            <button 
              className="btn-dismiss"
              onClick={onDismiss}
              title="Recordar más tarde"
            >
              ✕
            </button>
          )}
          <button 
            className="btn-complete-profile"
            onClick={handleCompleteProfile}
          >
            Completar Perfil
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileIncompleteNotification;
