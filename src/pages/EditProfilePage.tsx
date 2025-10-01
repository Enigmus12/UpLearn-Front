import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "react-oidc-context";
import ApiUserService from '../service/Api-user';
import '../styles/EditProfilePage.css';
import { useAuthFlow } from '../utils/useAuthFlow';

interface User {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'STUDENT' | 'TUTOR';
  // Campos adicionales del perfil según UserUpdateDTO
  idType?: string;
  idNumber?: string;
  // Perfil de estudiante
  educationLevel?: string;
  // Perfil de tutor
  bio?: string;
  specializations?: string[];
  credentials?: string[];
}

interface UpdateData {
  name?: string;
  email?: string;
  phoneNumber?: string;
  // Campos adicionales del perfil
  idType?: string;
  idNumber?: string;
  // Perfil de estudiante
  educationLevel?: string;
  // Perfil de tutor
  bio?: string;
  specializations?: string[];
  credentials?: string[];
}

interface DeleteRoleResponse {
  userDeleted: boolean;
  message?: string;
  remainingRoles?: string[];
}

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { userRoles, isAuthenticated } = useAuthFlow();
  
  // Obtener el rol específico del state de navegación o usar el primer rol como fallback
  const currentRole = location.state?.currentRole || userRoles?.[0];
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // Estados para los formularios (actualizado según UserUpdateDTO)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    idType: '',
    idNumber: '',
    educationLevel: '',
    bio: '',
    specializations: [] as string[],
    credentials: [] as string[]
  });

  // Estados para inputs dinámicos
  const [specializationInput, setSpecializationInput] = useState('');
  const [credentialInput, setCredentialInput] = useState('');

  useEffect(() => {
    const loadUserProfile = async () => {
      // Verificar autenticación con Cognito
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }

      if (!userRoles || userRoles.length === 0) {
        navigate('/login');
        return;
      }

      setIsLoading(true);
      
      try {
        // Obtener datos específicos del rol usando token de Cognito
        if (!auth.user?.id_token) {
          throw new Error('No hay token disponible');
        }
        
        // Validar que el rol específico esté en los roles del usuario
        if (!userRoles?.includes(currentRole)) {
          console.error('❌ Rol no válido o no autorizado:', currentRole);
          throw new Error(`No tienes permisos para editar el perfil de ${currentRole}`);
        }
        
        let editableData;
        
        // Usar endpoint específico según el rol
        if (currentRole === 'student') {
          editableData = await ApiUserService.getStudentProfile(auth.user.id_token);
        } else if (currentRole === 'tutor') {
          editableData = await ApiUserService.getTutorProfile(auth.user.id_token);
        } else {
          throw new Error('Rol de usuario no válido');
        }
        
        // Crear objeto de usuario con datos del token y del backend
        const userData: User = {
          userId: auth.user.profile?.sub || 'unknown',
          name: editableData.name || '',
          email: editableData.email || '',
          phoneNumber: editableData.phoneNumber || '',
          role: currentRole.toUpperCase() as 'STUDENT' | 'TUTOR',
          idType: editableData.idType || '',
          idNumber: editableData.idNumber || '',
          educationLevel: editableData.educationLevel || '',
          bio: editableData.bio || '',
          specializations: editableData.specializations || [],
          credentials: editableData.credentials || []
        };

        setCurrentUser(userData);
        setFormData({
          name: editableData.name || '',
          email: editableData.email || '',
          phoneNumber: editableData.phoneNumber || '',
          idType: editableData.idType || '',
          idNumber: editableData.idNumber || '',
          educationLevel: editableData.educationLevel || '',
          bio: editableData.bio || '',
          specializations: editableData.specializations || [],
          credentials: editableData.credentials || []
        });
        
      } catch (error) {
        console.error('Error cargando perfil:', error);
        setErrors({ 
          general: error instanceof Error ? error.message : 'Error cargando el perfil' 
        });
        
        // Si hay error de autenticación, redirigir al login
        if (error instanceof Error && error.message.includes('401')) {
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, [navigate, auth.isAuthenticated, auth.user, userRoles, currentRole]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpiar errores cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const addSpecialization = () => {
    if (specializationInput.trim() && !formData.specializations.includes(specializationInput.trim())) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, specializationInput.trim()]
      }));
      setSpecializationInput('');
    }
  };

  const removeSpecialization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter((_, i) => i !== index)
    }));
  };

  const addCredential = () => {
    if (credentialInput.trim() && !formData.credentials.includes(credentialInput.trim())) {
      setFormData(prev => ({
        ...prev,
        credentials: [...prev.credentials, credentialInput.trim()]
      }));
      setCredentialInput('');
    }
  };

  const removeCredential = (index: number) => {
    setFormData(prev => ({
      ...prev,
      credentials: prev.credentials.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'El teléfono es requerido';
    }

    if (currentRole === 'student' && !formData.educationLevel.trim()) {
      newErrors.educationLevel = 'El nivel educativo es requerido';
    }

    if (currentRole === 'tutor') {
      if (!formData.bio.trim()) {
        newErrors.bio = 'La biografía es requerida';
      }
      if (formData.specializations.length === 0) {
        newErrors.specializations = 'Debe tener al menos una especialización';
      }
      if (formData.credentials.length === 0) {
        newErrors.credentials = 'Debe tener al menos una credencial';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!auth.user?.id_token) {
      setErrors({ general: 'No hay token de autenticación válido' });
      return;
    }

    setIsSaving(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const updateData: UpdateData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        idType: formData.idType,
        idNumber: formData.idNumber
      };

      // Agregar campos específicos según el rol
      if (currentRole === 'student') {
        updateData.educationLevel = formData.educationLevel;
      } else if (currentRole === 'tutor') {
        updateData.bio = formData.bio;
        updateData.specializations = formData.specializations;
        updateData.credentials = formData.credentials;
      }

      // Usar endpoint específico según el rol actual
      let updatedUser;
      if (currentRole === 'student') {
        updatedUser = await ApiUserService.updateStudentProfile(updateData, auth.user.id_token);
      } else if (currentRole === 'tutor') {
        updatedUser = await ApiUserService.updateTutorProfile(updateData, auth.user.id_token);
      } else {
        throw new Error('Rol de usuario no válido para actualización');
      }
      
      setSuccessMessage('¡Perfil actualizado exitosamente!');

      // redirigir después de unos segundos
      setTimeout(() => {
        if (currentRole === 'student') {
          navigate('/student-dashboard');
        } else if (currentRole === 'tutor') {
          navigate('/tutor-dashboard');
        } else {
          navigate('/');
        }
      }, 2000);

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      setErrors({ 
        general: error instanceof Error ? error.message : 'Error actualizando el perfil' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentRole === 'student') {
      navigate('/student-dashboard');
    } else if (currentRole === 'tutor') {
      navigate('/tutor-dashboard');
    } else {
      navigate('/');
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!auth.user?.id_token) {
      setErrors({ general: 'No hay token de autenticación válido' });
      return;
    }

    setIsDeleting(true);
    setErrors({});

    try {
      // Usar endpoint específico según el rol para eliminar
      let result: DeleteRoleResponse;
      if (currentRole === 'student') {
        result = await ApiUserService.removeStudentRole(auth.user.id_token) as DeleteRoleResponse;
      } else if (currentRole === 'tutor') {
        result = await ApiUserService.removeTutorRole(auth.user.id_token) as DeleteRoleResponse;
      } else {
        throw new Error('Rol de usuario no válido para eliminación');
      }
      
      if (result.userDeleted) {
        // Si se eliminó completamente el usuario
        alert('Tu cuenta ha sido eliminada completamente.');
        // Limpiar datos de autenticación y redirigir
        auth.removeUser();
        navigate('/');
      } else {
        // Si solo se eliminó el rol específico
        const roleText = currentRole === 'student' ? 'estudiante' : 'tutor';
        alert(`Tu rol de ${roleText} ha sido eliminado. ${result.message || ''}`);
        
        // Verificar si el usuario tiene otros roles para redirigir apropiadamente
        if (result.remainingRoles && result.remainingRoles.length > 0) {
          // Redirigir al dashboard del rol restante
          const remainingRole = result.remainingRoles[0];
          if (remainingRole === 'student') {
            navigate('/student-dashboard');
          } else if (remainingRole === 'tutor') {
            navigate('/tutor-dashboard');
          } else {
            navigate('/role-selection');
          }
        } else {
          // No quedan roles, ir a selección de roles
          navigate('/role-selection');
        }
      }
      
    } catch (error) {
      console.error('Error eliminando cuenta/rol:', error);
      setErrors({ 
        general: error instanceof Error ? error.message : 'Error eliminando la cuenta' 
      });
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner-icon">⏳</div>
          <p>Cargando datos del perfil...</p>
        </div>
      </div>
    );
  }

  if (!currentUser && !isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner error">
          <div className="spinner-icon">❌</div>
          <p>Error cargando el perfil</p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-container">
      <div className="edit-profile-content">
        <div className="profile-header">
          <h1>Editar Perfil</h1>
          <p>Actualiza tu información personal</p>
          <div className="user-role-badge">
            {currentRole === 'student' ? '🎓 Estudiante' : '👨‍🏫 Tutor'}
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          {/* Mensajes de error y éxito */}
          {errors.general && (
            <div className="alert alert-error">
              {errors.general}
            </div>
          )}
          
          {successMessage && (
            <div className="alert alert-success">
              {successMessage}
            </div>
          )}

          {/* Campos comunes */}
          <div className="form-section">
            <h2>Información Personal</h2>
            
            <div className="form-group">
              <label className="form-label">Nombre Completo</label>
              <input
                type="text"
                name="name"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Tu nombre completo"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isSaving}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="tu@email.com"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isSaving}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="tel"
                name="phoneNumber"
                className={`form-input ${errors.phoneNumber ? 'error' : ''}`}
                placeholder="Número de teléfono"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                disabled={isSaving}
              />
              {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Identificación</label>
              <select
                name="idType"
                className={`form-input ${errors.idType ? 'error' : ''}`}
                value={formData.idType}
                onChange={handleInputChange}
                disabled={isSaving}
              >
                <option value="">Selecciona tipo de identificación</option>
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="TI">Tarjeta de Identidad</option>
                <option value="PP">Pasaporte</option>
                <option value="RC">Registro Civil</option>
              </select>
              {errors.idType && <span className="error-message">{errors.idType}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Número de Identificación</label>
              <input
                type="text"
                name="idNumber"
                className={`form-input ${errors.idNumber ? 'error' : ''}`}
                placeholder="Número de identificación"
                value={formData.idNumber}
                onChange={handleInputChange}
                disabled={isSaving}
              />
              {errors.idNumber && <span className="error-message">{errors.idNumber}</span>}
            </div>
          </div>

          {/* Campos específicos para estudiante */}
          {currentRole === 'student' && (
            <div className="form-section">
              <h2>Información Académica</h2>
              
              <div className="form-group">
                <label className="form-label">Nivel Educativo</label>
                <select
                  name="educationLevel"
                  className={`form-input ${errors.educationLevel ? 'error' : ''}`}
                  value={formData.educationLevel}
                  onChange={handleInputChange}
                  disabled={isSaving}
                >
                  <option value="">Selecciona tu nivel educativo</option>
                  <option value="PRIMARIA">Primaria</option>
                  <option value="SECUNDARIA">Secundaria</option>
                  <option value="PREGRADO">Pregrado</option>
                  <option value="POSTGRADO">Postgrado</option>
                  <option value="OTRO">Otro</option>
                </select>
                {errors.educationLevel && <span className="error-message">{errors.educationLevel}</span>}
              </div>
            </div>
          )}

          {/* Campos específicos para tutor */}
          {currentRole === 'tutor' && (
            <div className="form-section">
              <h2>Información Profesional</h2>
              
              <div className="form-group">
                <label className="form-label">Biografía</label>
                <textarea
                  name="bio"
                  className={`form-input form-textarea ${errors.bio ? 'error' : ''}`}
                  placeholder="Cuéntanos sobre tu experiencia y enfoque como tutor..."
                  rows={4}
                  value={formData.bio}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.bio && <span className="error-message">{errors.bio}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Especializaciones</label>
                <div className="array-input-container">
                  <div className="array-input-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Matemáticas, Física, Programación..."
                      value={specializationInput}
                      onChange={(e) => setSpecializationInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                      disabled={isSaving}
                    />
                    <button 
                      type="button" 
                      className="add-button" 
                      onClick={addSpecialization}
                      disabled={isSaving}
                    >
                      Agregar
                    </button>
                  </div>
                  <div className="tags-container">
                    {formData.specializations.map((spec, index) => (
                      <span key={index} className="tag">
                        {spec}
                        <button 
                          type="button" 
                          onClick={() => removeSpecialization(index)}
                          disabled={isSaving}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.specializations && <span className="error-message">{errors.specializations}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Credenciales</label>
                <div className="array-input-container">
                  <div className="array-input-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Licenciatura en Matemáticas, Maestría en..."
                      value={credentialInput}
                      onChange={(e) => setCredentialInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCredential())}
                      disabled={isSaving}
                    />
                    <button 
                      type="button" 
                      className="add-button" 
                      onClick={addCredential}
                      disabled={isSaving}
                    >
                      Agregar
                    </button>
                  </div>
                  <div className="tags-container">
                    {formData.credentials.map((cred, index) => (
                      <span key={index} className="tag">
                        {cred}
                        <button 
                          type="button" 
                          onClick={() => removeCredential(index)}
                          disabled={isSaving}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.credentials && <span className="error-message">{errors.credentials}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="form-actions">
            <div className="main-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSaving || isDeleting}
              >
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={isSaving || isDeleting}
              >
                Cancelar
              </button>
            </div>
            
            {/* Botón de eliminar rol/cuenta */}
            <div className="danger-zone">
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={isSaving || isDeleting}
              >
                🗑️ Eliminar {currentRole === 'student' ? 'Rol de Estudiante' : 'Rol de Tutor'}
              </button>
              <p className="danger-text">
                {userRoles && userRoles.length > 1 
                  ? `Se eliminará tu rol de ${currentRole === 'student' ? 'estudiante' : 'tutor'}. Si es tu único rol, se eliminará toda la cuenta.`
                  : 'Al ser tu único rol, esta acción eliminará completamente tu cuenta y no se puede deshacer.'
                }
              </p>
            </div>
          </div>
        </form>

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={handleCancelDelete}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>⚠️ Confirmar Eliminación de Rol</h2>
              </div>
              
              <div className="modal-body">
                <p><strong>¿Estás seguro de que deseas eliminar tu rol de {currentRole === 'student' ? 'estudiante' : 'tutor'}?</strong></p>
                
                {userRoles && userRoles.length > 1 ? (
                  <>
                    <p>Se eliminará únicamente tu rol de {currentRole === 'student' ? 'estudiante' : 'tutor'}, pero mantendrás acceso con tus otros roles.</p>
                    <p>Se eliminará:</p>
                  </>
                ) : (
                  <>
                    <p>Al ser tu único rol, esta acción eliminará completamente tu cuenta.</p>
                    <p>Se eliminará permanentemente:</p>
                  </>
                )}
                
                <ul>
                  <li>✗ Tu perfil personal</li>
                  <li>✗ Toda tu información de contacto</li>
                  {currentRole === 'student' && (
                    <li>✗ Tu historial académico y tareas</li>
                  )}
                  {currentRole === 'tutor' && (
                    <>
                      <li>✗ Tu biografía y especializaciones</li>
                      <li>✗ Tus credenciales y certificaciones</li>
                    </>
                  )}
                  <li>✗ Todo el historial de actividades</li>
                </ul>
                <p className="warning-text">
                  <strong>Esta acción NO se puede deshacer.</strong>
                </p>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Eliminando...' : `Sí, Eliminar ${currentRole === 'student' ? 'Rol de Estudiante' : 'Rol de Tutor'}`}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditProfilePage;