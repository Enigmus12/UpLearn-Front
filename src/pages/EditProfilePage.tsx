import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiUserService from '../service/Api-user';
import '../styles/EditProfilePage.css';

interface User {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: 'STUDENT' | 'TUTOR';
  educationLevel?: string;
  bio?: string;
  specializations?: string[];
  credentials?: string[];
}

interface UpdateData {
  name?: string;
  email?: string;
  phoneNumber?: string;
  educationLevel?: string;
  bio?: string;
  specializations?: string[];
  credentials?: string[];
}

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // Estados para los formularios
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
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
      const user = ApiUserService.getCurrentUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setIsLoading(true);
      
      try {
        // Obtener datos editables reales del backend
        const editableData = await ApiUserService.getEditableProfile();
        console.log('Datos editables cargados:', editableData);
        
        // Crear objeto de usuario con datos del token y del backend
        const userData: User = {
          userId: user.userId,
          name: editableData.name,
          email: editableData.email,
          phoneNumber: editableData.phoneNumber,
          role: user.role as 'STUDENT' | 'TUTOR',
          educationLevel: editableData.educationLevel,
          bio: editableData.bio,
          specializations: editableData.specializations || [],
          credentials: editableData.credentials || []
        };

        setCurrentUser(userData);
        setFormData({
          name: editableData.name || '',
          email: editableData.email || '',
          phoneNumber: editableData.phoneNumber || '',
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
  }, [navigate]);

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

    if (currentUser?.role === 'STUDENT' && !formData.educationLevel.trim()) {
      newErrors.educationLevel = 'El nivel educativo es requerido';
    }

    if (currentUser?.role === 'TUTOR') {
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

    setIsSaving(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const updateData: UpdateData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber
      };

      // Agregar campos específicos según el rol
      if (currentUser?.role === 'STUDENT') {
        updateData.educationLevel = formData.educationLevel;
      } else if (currentUser?.role === 'TUTOR') {
        updateData.bio = formData.bio;
        updateData.specializations = formData.specializations;
        updateData.credentials = formData.credentials;
      }

      const updatedUser = await ApiUserService.updateProfile(updateData);
      console.log('Usuario actualizado:', updatedUser);
      
      setSuccessMessage('¡Perfil actualizado exitosamente!');

      // redirigir después de unos segundos
      setTimeout(() => {
        if (currentUser?.role === 'STUDENT') {
          navigate('/student-dashboard');
        } else if (currentUser?.role === 'TUTOR') {
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
    if (currentUser?.role === 'STUDENT') {
      navigate('/student-dashboard');
    } else if (currentUser?.role === 'TUTOR') {
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
    setIsDeleting(true);
    setErrors({});

    try {
      const message = await ApiUserService.deleteProfile();
      console.log('Cuenta eliminada:', message);
      
      // Mostrar mensaje de éxito
      alert('Tu cuenta ha sido eliminada exitosamente.');
      
      // Redirigir al home/login después de eliminar
      navigate('/');
      
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
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
            {currentUser?.role === 'STUDENT' ? '🎓 Estudiante' : '👨‍🏫 Tutor'}
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
          </div>

          {/* Campos específicos de Estudiante */}
          {currentUser?.role === 'STUDENT' && (
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

          {/* Campos específicos de Tutor */}
          {currentUser?.role === 'TUTOR' && (
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
            
            {/* Botón de eliminar cuenta */}
            <div className="danger-zone">
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={isSaving || isDeleting}
              >
                🗑️ Eliminar Cuenta
              </button>
              <p className="danger-text">
                Esta acción no se puede deshacer. Se eliminarán todos tus datos permanentemente.
              </p>
            </div>
          </div>
        </form>

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={handleCancelDelete}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>⚠️ Confirmar Eliminación</h2>
              </div>
              
              <div className="modal-body">
                <p><strong>¿Estás seguro de que deseas eliminar tu cuenta?</strong></p>
                <p>Esta acción eliminará permanentemente:</p>
                <ul>
                  <li>✗ Tu perfil personal</li>
                  <li>✗ Toda tu información de contacto</li>
                  {currentUser?.role === 'STUDENT' && (
                    <li>✗ Tu historial académico y tareas</li>
                  )}
                  {currentUser?.role === 'TUTOR' && (
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
                  {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Mi Cuenta'}
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