import React, { useState, useEffect } from 'react';
import { useDashboardSwitch } from '../utils/useDashboardSwitch';

interface DashboardSwitchButtonProps {
  currentRole: 'student' | 'tutor';
  className?: string;
}

const DashboardSwitchButton: React.FC<DashboardSwitchButtonProps> = ({
  currentRole,
  className = ''
}) => {
  const { switchToDashboard, canSwitchTo, isLoading, error } = useDashboardSwitch();
  const [canSwitch, setCanSwitch] = useState(false);

  const targetRole = currentRole === 'student' ? 'tutor' : 'student';
  const targetRoleText = targetRole === 'student' ? 'Estudiante' : 'Tutor';
  const targetIcon = targetRole === 'student' ? '📚' : '👨‍🏫';

  useEffect(() => {
    const checkPermissions = async () => {
      const canSwitchResult = await canSwitchTo(targetRole);
      setCanSwitch(canSwitchResult);
    };

    checkPermissions();
  }, [targetRole, canSwitchTo]);

  const handleSwitch = async () => {
    await switchToDashboard(targetRole);
  };

  // No mostrar el botón si no puede cambiar de rol
  if (!canSwitch) {
    return null;
  }

  return (
    <div className="dashboard-switch-container">
      <button
        className={`dashboard-switch-btn ${className}`}
        onClick={handleSwitch}
        disabled={isLoading}
        title={`Cambiar a dashboard de ${targetRoleText}`}
      >
        <span className="switch-icon">{targetIcon}</span>
        <span className="switch-text">
          {isLoading ? 'Cambiando...' : `Ir a ${targetRoleText}`}
        </span>
      </button>

      {error && (
        <div className="switch-error" style={{
          color: 'red',
          fontSize: '12px',
          marginTop: '4px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default DashboardSwitchButton;