/**
 * API client for the student-tutor-scheduler microservice (sin gateway).
 * Puedes sobreescribir con REACT_APP_SCHEDULER_API_BASE.
 */
export type CellStatus = 'DISPONIBLE' | 'ACTIVA' | 'ACEPTADO' | 'CANCELADO' | null;

export interface ScheduleCell {
  date: string;      // YYYY-MM-DD
  hour: string;      // HH:mm (24h)
  status: CellStatus;// 'DISPONIBLE' | 'ACTIVA' | 'ACEPTADO' | 'CANCELADO' | null
  reservationId?: string | null;
  studentId?: string | null;
}

export interface Reservation {
  id: string;
  tutorId: string;
  studentId: string;
  date: string;      // ISO date
  start: string;     // HH:mm:ss
  end: string;       // HH:mm:ss
  status: 'ACTIVA' | 'ACEPTADO' | 'CANCELADO';
  createdAt?: string;
  updatedAt?: string;
  // Enriquecidos desde backend (si existen):
  studentName?: string;
  tutorName?: string;
}

const DEFAULT_BASE = 'http://localhost:8090';
const BASE = (process.env.REACT_APP_SCHEDULER_API_BASE || DEFAULT_BASE).replace(/\/$/, '');

function headers(token?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function handle(res: Response) {
  if (!res.ok) {
    // Intenta parsear JSON de error de Spring
    let body: any = null;
    try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
    const msg = typeof body === 'string'
      ? body
      : body?.message || body?.error || body?.path || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (res.status === 204) return null as unknown as any;
  return res.json();
}

/** Grid semanal público de un tutor */
export async function getScheduleForTutor(tutorId: string, weekStart: string, token?: string): Promise<ScheduleCell[]> {
  const url = `${BASE}/api/schedule/tutor/${encodeURIComponent(tutorId)}?weekStart=${weekStart}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  return handle(res);
}

/** Crear reserva (estudiante) */
export async function createReservation(tutorId: string, date: string, hour: string, token?: string): Promise<Reservation> {
  const url = `${BASE}/api/reservations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ tutorId, date, hour })
  });
  return handle(res);
}

/** Mis reservas (estudiante) en rango [from,to] */
export async function getMyReservations(from: string, to: string, token?: string): Promise<Reservation[]> {
  const url = `${BASE}/api/reservations/my?from=${from}&to=${to}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  return handle(res);
}

/** Reservas para mí (como tutor) en rango */
export async function getTutorReservations(from: string, to: string, token?: string): Promise<Reservation[]> {
  const url = `${BASE}/api/reservations/for-me?from=${from}&to=${to}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  return handle(res);
}

/** Cancelar reserva propia (estudiante o tutor según backend) */
export async function cancelReservation(id: string, token?: string): Promise<Reservation> {
  const url = `${BASE}/api/reservations/${id}/cancel`;
  const res = await fetch(url, { method: 'PATCH', headers: headers(token) });
  return handle(res);
}

/** Aceptar reserva (tutor) */
export async function acceptReservation(id: string, token?: string): Promise<Reservation> {
  const url = `${BASE}/api/reservations/${id}/accept`;
  const res = await fetch(url, { method: 'PATCH', headers: headers(token) });
  return handle(res);
}

/** Reemplazar disponibilidad de un día (tutor) - CUIDADO: elimina horas no incluidas */
export async function replaceDayAvailability(date: string, hours: string[], token?: string): Promise<void> {
  const url = `${BASE}/api/availability/day/${date}`;
  const res = await fetch(url, { method: 'PUT', headers: headers(token), body: JSON.stringify({ hours }) });
  await handle(res);
}

/** NUEVA: Agregar disponibilidad sin eliminar existente (tutor) */
export async function addAvailability(date: string, hours: string[], token?: string): Promise<void> {
  const url = `${BASE}/api/availability/add`;
  const res = await fetch(url, { 
    method: 'POST', 
    headers: headers(token), 
    body: JSON.stringify({ date, hours }) 
  });
  await handle(res);
}

/** NUEVA: Eliminar slots específicos de disponibilidad (tutor) */
export async function deleteAvailabilitySlots(slotIds: string[], token?: string): Promise<void> {
  const url = `${BASE}/api/availability/delete-batch`;
  const res = await fetch(url, { 
    method: 'DELETE', 
    headers: headers(token), 
    body: JSON.stringify({ slotIds }) 
  });
  await handle(res);
}

/** Generar disponibilidad por periodo (tutor) */
export interface BulkAvailabilityRequest {
  fromDate: string;  // YYYY-MM-DD
  toDate: string;    // YYYY-MM-DD
  fromHour: string;  // HH:mm
  toHour: string;    // HH:mm (exclusive)
  daysOfWeek?: number[]; // 1..7
  timezone?: string;
}
export async function bulkAvailability(req: BulkAvailabilityRequest, token?: string): Promise<any> {
  const url = `${BASE}/api/availability/bulk`;
  const res = await fetch(url, { method: 'POST', headers: headers(token), body: JSON.stringify(req) });
  return handle(res);
}

/** Disponibilidad pública de un tutor para una semana */
export async function getPublicAvailabilityForTutor(tutorId: string, weekStart: string, token?: string): Promise<ScheduleCell[]> {
  const url = `${BASE}/api/availability/tutor/${encodeURIComponent(tutorId)}?weekStart=${weekStart}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  return handle(res);
}