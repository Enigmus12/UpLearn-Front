const viteEnv = (import.meta !== undefined ? (import.meta as any).env : undefined) || {};

export const ENV = {
  // Base del scheduler
  SCHEDULER_BASE:
    viteEnv.VITE_SCHEDULER_BASE_URL ||
    process.env.REACT_APP_SCHEDULER_API_BASE ||
    'https://reservations-service-axhua9hde6cbbqac.canadacentral-01.azurewebsites.net',

  // Base del users service. Para CRA ya incluye /Api-user
  USERS_BASE:
    viteEnv.VITE_USERS_BASE_URL ||
    process.env.REACT_APP_USER_API_BASE ||  
    'https://users-service-c9bhh8agamhndhg2.canadacentral-01.azurewebsites.net/Api-user',

  // Ruta del endpoint público (si USERS_BASE ya incluye /Api-user, aquí solo /public/profile)
  USERS_PROFILE_PATH:
    viteEnv.VITE_USERS_PROFILE_PATH ||
    '/public/profile',

  // Base del payment service
  PAYMENT_BASE:
    viteEnv.VITE_PAYMENT_BASE_URL ||
    process.env.REACT_APP_PAYMENT_API_BASE ||
    'https://wallet-service-evh5ccbsbwb9cfh8.canadacentral-01.azurewebsites.net/api',

  // Base del chat service
  CHAT_BASE:
    viteEnv.VITE_CHAT_API_BASE_URL ||
    process.env.REACT_APP_CHAT_API_BASE ||
    'http://54.196.0.137:8091',

  // Base del call service
  CALL_BASE:
    viteEnv.VITE_CALL_API_BASE_URL ||
    process.env.REACT_APP_CALL_API_BASE ||
    'http://52.3.72.178:8093',

  // Base del search service
  SEARCH_BASE:
    viteEnv.VITE_SEARCH_API_BASE_URL ||
    process.env.REACT_APP_SEARCH_API_BASE ||
    'https://users-service-c9bhh8agamhndhg2.canadacentral-01.azurewebsites.net/Api-search',
};
