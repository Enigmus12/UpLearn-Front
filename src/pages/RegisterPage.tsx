import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiUserService from '../service/Api-user';
import '../styles/RegisterPage.css';

type UserRole = 'STUDENT' | 'TUTOR';

interface StudentFormData {
  name: string;
  idType: string;
  idNumber: string;
  email: string;
  userId: string;
  password: string;
  passwordConfirmation: string;
  phoneNumber: string;
  role: UserRole;
  educationLevel: string;
}

interface TutorFormData {
  name: string;
  idType: string;
  idNumber: string;
  email: string;
  userId: string;
  password: string;
  passwordConfirmation: string;
  phoneNumber: string;
  role: UserRole;
  bio: string;
  specializations: string[];
  credentials: string[];
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<UserRole>('STUDENT');
  const [specializationInput, setSpecializationInput] = useState('');
  const [credentialInput, setCredentialInput] = useState('');

  const [studentData, setStudentData] = useState<StudentFormData>({
    name: '',
    idType: 'CC',
    idNumber: '',
    email: '',
    userId: '',
    password: '',
    passwordConfirmation: '',
    phoneNumber: '',
    role: 'STUDENT',
    educationLevel: '',
  });

  const [tutorData, setTutorData] = useState<TutorFormData>({
    name: '',
    idType: 'CC',
    idNumber: '',
    email: '',
    userId: '',
    password: '',
    passwordConfirmation: '',
    phoneNumber: '',
    role: 'TUTOR',
    bio: '',
    specializations: [],
    credentials: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStudentData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTutorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTutorData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const addSpecialization = () => {
    if (specializationInput.trim()) {
      setTutorData(prev => ({
        ...prev,
        specializations: [...prev.specializations, specializationInput.trim()]
      }));
      setSpecializationInput('');
    }
  };

  const removeSpecialization = (index: number) => {
    setTutorData(prev => ({
      ...prev,
      specializations: prev.specializations.filter((_, i) => i !== index)
    }));
  };

  const addCredential = () => {
    if (credentialInput.trim()) {
      setTutorData(prev => ({
        ...prev,
        credentials: [...prev.credentials, credentialInput.trim()]
      }));
      setCredentialInput('');
    }
  };

  const removeCredential = (index: number) => {
    setTutorData(prev => ({
      ...prev,
      credentials: prev.credentials.filter((_, i) => i !== index)
    }));
  };

  const validateCommonFields = (data: StudentFormData | TutorFormData) => {
    const newErrors: Record<string, string> = {};

    if (!data.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!data.idNumber.trim()) newErrors.idNumber = 'El número de identificación es requerido';
    if (!data.email.trim()) newErrors.email = 'El email es requerido';
    else if (!/\S+@\S+\.\S+/.test(data.email)) newErrors.email = 'Email inválido';
    if (!data.userId.trim()) newErrors.userId = 'El ID de usuario es requerido';
    if (!data.password.trim()) newErrors.password = 'La contraseña es requerida';
    else if (data.password.length < 6) newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    if (data.password !== data.passwordConfirmation) newErrors.passwordConfirmation = 'Las contraseñas no coinciden';
    if (!data.phoneNumber.trim()) newErrors.phoneNumber = 'El teléfono es requerido';

    return newErrors;
  };

  const validateStudent = (data: StudentFormData) => {
    const errors = validateCommonFields(data);
    if (!data.educationLevel.trim()) errors.educationLevel = 'El nivel educativo es requerido';
    return errors;
  };

  const validateTutor = (data: TutorFormData) => {
    const errors = validateCommonFields(data);
    if (!data.bio.trim()) errors.bio = 'La biografía es requerida';
    if (data.specializations.length === 0) errors.specializations = 'Debe agregar al menos una especialización';
    if (data.credentials.length === 0) errors.credentials = 'Debe agregar al menos una credencial';
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let validationErrors: Record<string, string> = {};
    let formData: StudentFormData | TutorFormData;

    if (activeTab === 'STUDENT') {
      validationErrors = validateStudent(studentData);
      formData = studentData;
    } else {
      validationErrors = validateTutor(tutorData);
      formData = tutorData;
    }

    setErrors(validationErrors);
    setSuccessMessage('');

    if (Object.keys(validationErrors).length === 0) {
      setIsLoading(true);
      
      try {
        let response;
        
        if (activeTab === 'STUDENT') {
          response = await ApiUserService.registerStudent(formData);
        } else {
          response = await ApiUserService.registerTutor(formData);
        }

        // Registro exitoso
        setSuccessMessage(`¡Registro exitoso! Bienvenido ${response.name}`);
        
        // Limpiar formularios
        if (activeTab === 'STUDENT') {
          setStudentData({
            name: '',
            idType: 'CC',
            idNumber: '',
            email: '',
            userId: '',
            password: '',
            passwordConfirmation: '',
            phoneNumber: '',
            role: 'STUDENT',
            educationLevel: '',
          });
        } else {
          setTutorData({
            name: '',
            idType: 'CC',
            idNumber: '',
            email: '',
            userId: '',
            password: '',
            passwordConfirmation: '',
            phoneNumber: '',
            role: 'TUTOR',
            bio: '',
            specializations: [],
            credentials: [],
          });
          setSpecializationInput('');
          setCredentialInput('');
        }

        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        
      } catch (error) {
        console.error('Error en registro:', error);
        setErrors({ 
          general: error instanceof Error ? error.message : 'Error en el registro'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="register-container">
      <div className="register-content">
        <div className="register-header">
          <h1 className="register-title">Crear Cuenta</h1>
          <p className="register-subtitle">Únete a la comunidad de UpLearn</p>
        </div>

        <div className="tab-container">
          <button
            className={`tab-button ${activeTab === 'STUDENT' ? 'active' : ''}`}
            onClick={() => setActiveTab('STUDENT')}
          >
            Estudiante
          </button>
          <button
            className={`tab-button ${activeTab === 'TUTOR' ? 'active' : ''}`}
            onClick={() => setActiveTab('TUTOR')}
          >
            Tutor
          </button>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
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
          <div className="form-group">
            <label className="form-label">Nombre Completo</label>
            <input
              type="text"
              name="name"
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Ingresa tu nombre completo"
              value={activeTab === 'STUDENT' ? studentData.name : tutorData.name}
              onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de ID</label>
              <select
                name="idType"
                className="form-input"
                value={activeTab === 'STUDENT' ? studentData.idType : tutorData.idType}
                onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
              >
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="TI">Tarjeta de Identidad</option>
                <option value="PP">Pasaporte</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Número de ID</label>
              <input
                type="text"
                name="idNumber"
                className={`form-input ${errors.idNumber ? 'error' : ''}`}
                placeholder="Número de identificación"
                value={activeTab === 'STUDENT' ? studentData.idNumber : tutorData.idNumber}
                onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
              />
              {errors.idNumber && <span className="error-message">{errors.idNumber}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="tu@email.com"
              value={activeTab === 'STUDENT' ? studentData.email : tutorData.email}
              onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">ID de Usuario</label>
            <input
              type="text"
              name="userId"
              className={`form-input ${errors.userId ? 'error' : ''}`}
              placeholder="Nombre de usuario único"
              value={activeTab === 'STUDENT' ? studentData.userId : tutorData.userId}
              onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
            />
            {errors.userId && <span className="error-message">{errors.userId}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                name="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Contraseña"
                value={activeTab === 'STUDENT' ? studentData.password : tutorData.password}
                onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar Contraseña</label>
              <input
                type="password"
                name="passwordConfirmation"
                className={`form-input ${errors.passwordConfirmation ? 'error' : ''}`}
                placeholder="Confirma tu contraseña"
                value={activeTab === 'STUDENT' ? studentData.passwordConfirmation : tutorData.passwordConfirmation}
                onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
              />
              {errors.passwordConfirmation && <span className="error-message">{errors.passwordConfirmation}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input
              type="tel"
              name="phoneNumber"
              className={`form-input ${errors.phoneNumber ? 'error' : ''}`}
              placeholder="Número de teléfono"
              value={activeTab === 'STUDENT' ? studentData.phoneNumber : tutorData.phoneNumber}
              onChange={activeTab === 'STUDENT' ? handleStudentChange : handleTutorChange}
            />
            {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
          </div>

          {/* Campos específicos de ESTUDIANTE */}
          {activeTab === 'STUDENT' && (
            <div className="form-group">
              <label className="form-label">Nivel Educativo</label>
              <select
                name="educationLevel"
                className={`form-input ${errors.educationLevel ? 'error' : ''}`}
                value={studentData.educationLevel}
                onChange={handleStudentChange}
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
          )}

          {/* Campos específicos de TUTOR */}
          {activeTab === 'TUTOR' && (
            <>
              <div className="form-group">
                <label className="form-label">Biografía</label>
                <textarea
                  name="bio"
                  className={`form-input form-textarea ${errors.bio ? 'error' : ''}`}
                  placeholder="Cuéntanos sobre tu experiencia y enfoque como tutor..."
                  rows={4}
                  value={tutorData.bio}
                  onChange={handleTutorChange}
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
                    />
                    <button type="button" className="add-button" onClick={addSpecialization}>
                      Agregar
                    </button>
                  </div>
                  <div className="tags-container">
                    {tutorData.specializations.map((spec, index) => (
                      <span key={index} className="tag">
                        {spec}
                        <button type="button" onClick={() => removeSpecialization(index)}>×</button>
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
                    />
                    <button type="button" className="add-button" onClick={addCredential}>
                      Agregar
                    </button>
                  </div>
                  <div className="tags-container">
                    {tutorData.credentials.map((cred, index) => (
                      <span key={index} className="tag">
                        {cred}
                        <button type="button" onClick={() => removeCredential(index)}>×</button>
                      </span>
                    ))}
                  </div>
                  {errors.credentials && <span className="error-message">{errors.credentials}</span>}
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading 
                ? 'Registrando...' 
                : `Registrarse como ${activeTab === 'STUDENT' ? 'Estudiante' : 'Tutor'}`
              }
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

        <div className="register-footer">
          <p>¿Ya tienes cuenta? <button className="link-button" onClick={() => navigate('/login')}>Inicia sesión aquí</button></p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;