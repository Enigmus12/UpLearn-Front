// Lee variables de entorno en CRA (process.env.REACT_APP_*) o Vite (import.meta.env)
const viteEnv = (import.meta !== undefined ? (import.meta as any).env : undefined) || {};

export const ENV = {
  // Base del scheduler
  SCHEDULER_BASE:
    viteEnv.VITE_SCHEDULER_BASE_URL ||
    process.env.REACT_APP_SCHEDULER_API_BASE ||
    'http://localhost:8090',

  // Base del servicio de chat
  CHAT_API_BASE:
    viteEnv.VITE_CHAT_API_BASE_URL ||
    process.env.REACT_APP_CHAT_API_BASE ||
    'http://localhost:8091',

  // Base del users service. Para CRA ya incluye /Api-user
  USERS_BASE:
    viteEnv.VITE_USERS_BASE_URL ||
    process.env.REACT_APP_USER_API_BASE ||   // ej: http://localhost:8080/Api-user
    'http://localhost:8080/Api-user',

  // Ruta del endpoint público (si USERS_BASE ya incluye /Api-user, aquí solo /public/profile)
  USERS_PROFILE_PATH:
    viteEnv.VITE_USERS_PROFILE_PATH ||
    '/public/profile',
};