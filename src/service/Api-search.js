// src/service/Api-search.js
const API_BASE_URL = 'http://localhost:8080/Api-search';

class ApiSearchService {
  static async searchTutors(query) {
    try {
      const url = `${API_BASE_URL}/tutors?q=${encodeURIComponent(query || '')}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error('Error buscando tutores');
      return await res.json();
    } catch (err) {
      console.error('ApiSearchService.searchTutors error:', err);
      throw err;
    }
  }
}

export default ApiSearchService;
