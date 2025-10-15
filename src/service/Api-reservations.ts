// src/service/Api-reservations.ts
  const BASE = process.env.REACT_APP_RESERVATION_API || "http://localhost:8090/api";

  function authHeaders(token?: string, extra?: Record<string, string>) {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    if (extra) Object.assign(h, extra);
    return h;
  }

  export async function fetchWeekAvailability(
    tutorId: string,
    weekStart: string,
    slotMinutes: number,
    dayStart: string,
    dayEnd: string
  ) {
    const qs = new URLSearchParams({
      tutorId,
      weekStart,
      slotMinutes: String(slotMinutes),
      dayStart,
      dayEnd,
    });
    const res = await fetch(`${BASE}/availability/week?${qs.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  export type HourSlot = { start: string; end: string };

  export async function setDayAvailability(
    tutorId: string,
    day: string,
    slots: HourSlot[],
    token: string
  ) {
    // Asegurar "HH:00:00" al enviar
    const toHH = (t: string): string => {
      if (!t) return "00:00:00";
      const hh = t.slice(0, 2);
      return `${hh}:00:00`;
    };

    const payload = slots.map((s: HourSlot) => ({
      start: toHH(s.start),
      end: toHH(s.end),
    }));

    const res = await fetch(`${BASE}/availability/${tutorId}/day/${day}`, {
      method: "PUT",
      headers: authHeaders(token, { "X-App-Role": "tutor" }),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text || "Forbidden"}`);
    }
    return res.json();
  }

  export async function createReservation(
    payload: { tutorId: string; day: string; start: string; end: string },
    token?: string,              // 👈 que sea opcional
    subject?: string
  ) {
    const res = await fetch(`${BASE}/reservations`, {
      method: "POST",
      headers: authHeaders(undefined, {   // 👈 fuerza SIN Authorization
        "X-App-Role": "student",
        "X-Subject": subject ?? ""
      }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }



  export async function listTutorReservations(tutorId: string, token: string) {
    const res = await fetch(`${BASE}/reservations/by-tutor/${tutorId}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  export async function listStudentReservations(studentSub: string, token: string) {
    const res = await fetch(`${BASE}/reservations/by-student/${studentSub}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
