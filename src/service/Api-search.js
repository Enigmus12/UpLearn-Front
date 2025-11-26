// src/service/Api-search.js
const API_BASE_URL = 'http://localhost:8080/Api-search';

class ApiSearchService {
  static async searchTutors(query) {
    try {
      const trimmed = (query ?? '').trim();
      const hasQuery = trimmed.length > 0;

      // 👉 Si NO hay query, NO mandamos ?q=
      const url = hasQuery
        ? `${API_BASE_URL}/tutors?q=${encodeURIComponent(trimmed)}`
        : `${API_BASE_URL}/tutors`;

      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error('Error buscando tutores');

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('ApiSearchService.searchTutors error:', err);
      throw err;
    }
  }
}

export default ApiSearchService;
