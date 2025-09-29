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

  // ========== MÉTODOS PARA COGNITO ==========

  /**
   * Establece el token de Cognito actual para usar en las peticiones
   * @param {string} cognitoToken - Token de Cognito
   */
  static setCognitoToken(cognitoToken) {
    this.token = cognitoToken;
    // Opcionalmente también guardarlo en localStorage para persistencia
    localStorage.setItem('uplearn_cognito_token', cognitoToken);
  }

  /**
   * Obtiene el token de Cognito actual
   * @returns {string|null} Token de Cognito
   */
  static getCognitoToken() {
    // Primero intentar obtener del storage local, luego del token actual
    return localStorage.getItem('uplearn_cognito_token') || this.token;
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

  // ========== GESTIÓN DE USUARIOS ==========

  /**
   * Obtiene los datos editables del usuario autenticado usando token de Cognito
   * @param {string} cognitoToken - Token de Cognito 
   * @returns {Promise<UserUpdateDTO>}
   */
  static async getEditableProfile(cognitoToken = null) {
    const token = cognitoToken || this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('Obteniendo datos editables del perfil con Cognito');
      
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
   * Actualiza el perfil del usuario autenticado usando token de Cognito
   * @param {Object} updateData - Datos a actualizar según UserUpdateDTO
   * @param {string} cognitoToken - Token de Cognito (opcional, si no se provee se usa el almacenado)
   * @returns {Promise<User>}
   */
  static async updateProfile(updateData, cognitoToken = null) {
    // Usar el token de Cognito si se provee, sino usar el token almacenado
    const token = cognitoToken || this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('Enviando actualización de perfil con Cognito:', updateData);
      
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
   * Elimina la cuenta del usuario autenticado usando token de Cognito
   * @param {string} cognitoToken - Token de Cognito (opcional, si no se provee se usa el almacenado)
   * @returns {Promise<string>}
   */
  static async deleteProfile(cognitoToken = null) {
    // Usar el token de Cognito si se provee, sino usar el token almacenado
    const token = cognitoToken || this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('Eliminando cuenta del usuario con Cognito');
      
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

  // ========== INTEGRACIÓN CON COGNITO ==========

  /**
   * Procesa y registra un usuario de Cognito en el backend
   * @param {string} cognitoToken - Token de Cognito
   * @returns {Promise<User>}
   */
  static async processCognitoUser(cognitoToken) {
    try {
      console.log('Enviando token de Cognito al backend');
      
      const response = await fetch(`${API_BASE_URL}/process-cognito-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: cognitoToken 
        }),
      });

      console.log('Respuesta del servidor para Cognito:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error del servidor procesando Cognito:', errorText);
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const user = await response.json();
      console.log('Usuario procesado desde Cognito:', user);
      
      // Guardar el token de Cognito para futuras peticiones si es necesario
      // this.setToken(cognitoToken);
      
      return user;
    } catch (error) {
      console.error('Error procesando usuario de Cognito:', error);
      throw error;
    }
  }


}

export default ApiUserService; 
