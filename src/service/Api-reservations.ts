// Api-reservations.ts
const BASE = 'http://localhost:8090/api/reservations';
// Api-reservations.ts
export async function fetchWeekAvailability(
  token: string,
  tutorId: string,
  weekStart: string,
  slotMinutes: number,
  dayStart: string,
  dayEnd: string
) {
  const url = `http://localhost:8090/api/reservations/availability/week`
    + `?tutorId=${encodeURIComponent(tutorId)}`
    + `&weekStart=${encodeURIComponent(weekStart)}`
    + `&dayStart=${encodeURIComponent(dayStart)}`
    + `&dayEnd=${encodeURIComponent(dayEnd)}`
    + `&slotMinutes=${slotMinutes}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,   // <-- imprescindible
      'Accept': 'application/json'
    },
    credentials: 'include' // opcional
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} - ${body}`);
  }
  return res.json();
}


  export async function createReservation(
    token: string,
    payload: { tutorId: string; day: string; start: string; end: string; }
  ) {
    const res = await fetch(`${BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let msg = 'Error creando reserva';
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

