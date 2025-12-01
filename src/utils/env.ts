const viteEnv = (import.meta !== undefined ? (import.meta as any).env : undefined) || {};

export const ENV = {
  // Base del scheduler
  SCHEDULER_BASE:
    viteEnv.VITE_SCHEDULER_BASE_URL ||
    process.env.REACT_APP_SCHEDULER_API_BASE ||
    'http://54.167.85.51:8090',

  // Base del users service. Para CRA ya incluye /Api-user
  USERS_BASE:
    viteEnv.VITE_USERS_BASE_URL ||
    process.env.REACT_APP_USER_API_BASE ||  
    'http://13.221.116.132:8080/Api-user',

  // Ruta del endpoint público (si USERS_BASE ya incluye /Api-user, aquí solo /public/profile)
  USERS_PROFILE_PATH:
    viteEnv.VITE_USERS_PROFILE_PATH ||
    '/public/profile',

  // Base del payment service
  PAYMENT_BASE:
    viteEnv.VITE_PAYMENT_BASE_URL ||
    process.env.REACT_APP_PAYMENT_API_BASE ||
    ' http://34.228.55.18:8081/api',

  // Base del chat service
  CHAT_BASE:
    viteEnv.VITE_CHAT_API_BASE_URL ||
    process.env.REACT_APP_CHAT_API_BASE ||
    'http://3.90.235.238:8091',

  // Base del call service
  CALL_BASE:
    viteEnv.VITE_CALL_API_BASE_URL ||
    process.env.REACT_APP_CALL_API_BASE ||
    'http://54.88.120.20:8093',

  // Base del search service
  SEARCH_BASE:
    viteEnv.VITE_SEARCH_API_BASE_URL ||
    process.env.REACT_APP_SEARCH_API_BASE ||
    'http://13.221.116.132:8080/Api-search',
};
