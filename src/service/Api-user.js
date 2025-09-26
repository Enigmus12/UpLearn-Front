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
    return decoded ? {
      userId: decoded.userId,
      role: decoded.role
    } : null;
  }

  // ========== AUTENTICACIÓN ==========

  /**
   * Autentica un usuario en el sistema
   * @param {string} userName - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Promise<AuthenticationResponseDTO>}
   */
  static async login(userName, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: userName,
          password: password
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Si la autenticación es exitosa, guardar el token
      if (data.success && data.token) {
        this.setToken(data.token);
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

  /**
   * Elimina un usuario por su ID (requiere autenticación)
   * @param {string} userId - ID del usuario a eliminar
   * @returns {Promise<User[]>} - Lista actualizada de usuarios
   */
  static async deleteUser(userId) {
    const token = this.getToken();
    try {
      const response = await fetch(`${API_BASE_URL}/Delete-user/${userId}`, {
        method: 'DELETE',
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
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }
}

export default ApiUserService; 
