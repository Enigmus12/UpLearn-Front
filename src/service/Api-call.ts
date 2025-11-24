const API_BASE_URL = 'http://localhost:8093'; 

export async function createCallSession(reservationId: string, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/calls/session`, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ reservationId }),
  });
  
  if (!res.ok) {
     const text = await res.text(); 
     throw new Error(`Error ${res.status}: ${text || 'No se pudo crear la sesión'}`);
  }
  
  return res.json() as Promise<{ sessionId: string; reservationId: string; ttlSeconds: number; }>;
}

export async function getIceServers() {
  const res = await fetch(`${API_BASE_URL}/api/calls/ice-servers`);
  return JSON.parse(await res.text());
}