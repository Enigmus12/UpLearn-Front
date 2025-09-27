// src/service/Api-user.js
// Clase para manejar peticiones a la API de UpLearn y gestión de token

const API_BASE_URL = 'http://localhost:8080/Api-user';

class ApiUserService {
  static token = null;

  static setToken(token) {
    this.token = token;
    localStorage.setItem('uplearn_token', token);
  }

  static getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('uplearn_token');
    }
    return this.token;
  }

  static clearToken() {
    this.token = null;
    localStorage.removeItem('uplearn_token');
  }

  // Decodifica un JWT y retorna el payload como objeto
  static decodeToken() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded;
    } catch (e) {
      console.error('Error decoding token:', e);
      return null;
    }
  }

  // Obtiene información del usuario autenticado desde el token
  static getCurrentUser() {
    const decoded = this.decodeToken();
    if (!decoded) return null;
    
    console.log('Token decodificado:', decoded);

    // nosotros en el backend usamos 'sub' para userId y 'role' para el rol
    return decoded ? {
      userId: decoded.sub,    // En JWT estándar, 'sub' es el subject (userId)
      role: decoded.role
    } : null;
  }

  // ========== AUTENTICACIÓN ==========

  /**
   * Autentica un usuario en el sistema
   * @param {string} userId - ID del usuario (no userName)
   * @param {string} password - Contraseña
   * @returns {Promise<AuthenticationResponseDTO>}
   */
  static async login(userId, password) {
    try {
      console.log('Enviando petición de login:', { userId, password });
      
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          password: password
        }),
      });

      console.log('Respuesta del servidor:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error del servidor:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Datos recibidos del servidor:', data);
      
      // Si la autenticación es exitosa, guardar el token
      // Actualizar para usar la estructura real de respuesta
      if (data.authenticated && data.token) {
        console.log('Login exitoso, guardando token:', data.token);
        this.setToken(data.token);
        console.log('Token guardado correctamente');
      }
      
      return data;
    } catch (error) {
      console.error('Error en login:', error);
      throw new Error('Error de conexión. Verifica que el servidor esté disponible.');
    }
  }

  /**
   * Cierra sesión del usuario
   */
  static logout() {
    this.clearToken();
  }

  // ========== REGISTRO ==========

  /**
   * Registra un nuevo estudiante
   * @param {Object} studentData - Datos del estudiante
   * @returns {Promise<User>}
   */
  static async registerStudent(studentData) {
    try {
      const response = await fetch(`${API_BASE_URL}/register-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...studentData,
          role: 'STUDENT'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al registrar estudiante');
      }

      return response.json();
    } catch (error) {
      console.error('Error registrando estudiante:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo tutor
   * @param {Object} tutorData - Datos del tutor
   * @returns {Promise<User>}
   */
  static async registerTutor(tutorData) {
    try {
      const response = await fetch(`${API_BASE_URL}/register-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...tutorData,
          role: 'TUTOR'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al registrar tutor');
      }

      return response.json();
    } catch (error) {
      console.error('Error registrando tutor:', error);
      throw error;
    }
  }

  // ========== GESTIÓN DE USUARIOS ==========

  /**
   * Obtiene los datos editables del usuario autenticado
   * @returns {Promise<UserUpdateDTO>}
   */
  static async getEditableProfile() {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('Obteniendo datos editables del perfil');
      
      const response = await fetch(`${API_BASE_URL}/editable-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Respuesta del servidor:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error del servidor:', errorText);
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Datos editables obtenidos:', data);
      return data;
    } catch (error) {
      console.error('Error obteniendo datos editables:', error);
      throw error;
    }
  }

  /**
   * Actualiza el perfil del usuario autenticado
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<User>}
   */
  static async updateProfile(updateData) {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('Enviando actualización de perfil:', updateData);
      
      const response = await fetch(`${API_BASE_URL}/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      console.log('Respuesta del servidor:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error del servidor:', errorText);
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Perfil actualizado:', data);
      return data;
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      throw error;
    }
  }

  /**
   * Elimina la cuenta del usuario autenticado
   * @returns {Promise<string>}
   */
  static async deleteProfile() {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('Eliminando cuenta del usuario');
      
      const response = await fetch(`${API_BASE_URL}/delete-profile`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Respuesta del servidor:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error del servidor:', errorText);
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const message = await response.text();
      console.log('Cuenta eliminada:', message);
      
      // Limpiar token después de eliminar cuenta
      this.clearToken();
      
      return message;
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los usuarios (requiere autenticación)
   * @returns {Promise<User[]>}
   */
  static async getAllUsers() {
    const token = this.getToken();
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtiene un usuario por su ID (requiere autenticación)
   * @param {string} userId - ID del usuario
   * @returns {Promise<User>}
   */
  static async getUserById(userId) {
    const token = this.getToken();
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      throw error;
    }
  }


}

export default ApiUserService; 
