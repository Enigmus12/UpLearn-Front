/**
 * API client for the student-tutor-scheduler microservice .
 */

export type CellStatus =
  | 'DISPONIBLE'
  | 'PENDIENTE'
  | 'ACEPTADO'
  | 'CANCELADO'
  | 'VENCIDA'
  | 'ACTIVA'
  | 'INCUMPLIDA'
  | 'FINALIZADA'
  | null;

export interface ScheduleCell {
  date: string;      // YYYY-MM-DD
  hour: string;      // HH:mm
  status: CellStatus;
  reservationId?: string | null;
  tutorId?: string | null;
  studentId?: string | null;

  // enriquecidos opcionales
  studentName?: string;
  studentAvatar?: string;
  tutorName?: string;
  tutorAvatar?: string;
}

/** Reserva */
export interface Reservation {
  id: string;
  tutorId: string;
  studentId: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm:ss o HH:mm
  end: string;    // HH:mm:ss o HH:mm
  status: 'PENDIENTE' | 'ACEPTADO' | 'CANCELADO' | 'ACTIVA' | 'INCUMPLIDA' | 'FINALIZADA';
  attended?: boolean | null;

  // enriquecidos (views)
  studentName?: string;
  studentAvatar?: string;
  tutorName?: string;
  tutorAvatar?: string;
}


const DEFAULT_BASE = 'http://localhost:8090';
const BASE = (process.env.REACT_APP_SCHEDULER_API_BASE || DEFAULT_BASE).replace(/\/$/, '');

/* utilidades internas  */
function norm(h: string) {
  const s = (h ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
}
function headers(token?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
async function handle(res: Response) {
  if (!res.ok) {
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

/*  fechas */
function slotToLocalDate(dateISO: string, hhmm: string): Date {
  const [H, M] = norm(hhmm).split(':').map(Number);
  const dt = new Date(`${dateISO}T00:00:00`);
  dt.setHours(H, M, 0, 0);
  return dt;
}
function isPastSlot(dateISO: string, hhmm: string): boolean {
  const now = new Date();
  now.setSeconds(0, 0);
  return slotToLocalDate(dateISO, hhmm).getTime() < now.getTime();
}

/* normalizaciones */
function normalizeCellStatus(s: CellStatus | null | undefined): Exclude<CellStatus, 'ACTIVA'> | null {
  if (s === 'ACTIVA') return 'PENDIENTE';
  return (s ?? null) as any;
}
function normalizeReservationStatus(s?: string | null): Reservation['status'] {
  const up = (s ?? '').toUpperCase();
  switch (up) {
    case 'PENDIENTE':
    case 'ACEPTADO':
    case 'CANCELADO':
    case 'ACTIVA':
    case 'INCUMPLIDA':
    case 'FINALIZADA':
      return up;
    default:
      return 'PENDIENTE';
  }
}

/* API */

/** Grid semanal (tutor, completo) con normalización de estados */
export async function getScheduleForTutor(
  tutorId: string,
  weekStart: string,
  token?: string
): Promise<ScheduleCell[]> {
  const url = `${BASE}/api/schedule/tutor/${encodeURIComponent(tutorId)}?weekStart=${weekStart}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  const raw = (await handle(res)) as ScheduleCell[];

  // normalizamos: ACTIVA a PENDIENTE, unificamos por (date,hour) quedándonos con el de mayor prioridad
  const priority: Record<Exclude<CellStatus, null>, number> = {
    ACEPTADO: 4,
    PENDIENTE: 3,   
    ACTIVA: 3,
    DISPONIBLE: 2,
    CANCELADO: 1,
    VENCIDA: 0,
    INCUMPLIDA: 0,
    FINALIZADA: 0,
  };
  const pr = (s: CellStatus | null | undefined) => (s ? (priority[s] ?? 0) : 0);
  // mapeo intermedio por clave date_hour
  const byKey = new Map<string, ScheduleCell>();
  for (const c of raw) {
    const hhmm = norm(c.hour);
    const key = `${c.date}_${hhmm}`;
    const prev = byKey.get(key);
    const next: ScheduleCell = { ...c, hour: hhmm, status: normalizeCellStatus(c.status) };
    if (!prev || pr(next.status) >= pr(prev.status)) byKey.set(key, next);
  }
   // de cancelado a null, de disponible vencida a vencida
  const result: ScheduleCell[] = [];
  for (const c of Array.from(byKey.values())) {
    if (c.status === 'CANCELADO') {
      result.push({ ...c, status: null, reservationId: null, studentId: null });
      continue;
    }
    if (c.status === 'DISPONIBLE' && isPastSlot(c.date, c.hour)) {
      result.push({ ...c, status: 'VENCIDA' });
      continue;
    }
    result.push(c);
  }
  return result;
}

/** Crear reserva (estudiante) */
export async function createReservation(
  tutorId: string,
  date: string,
  hour: string,
  token?: string
): Promise<Reservation> {
  const url = `${BASE}/api/reservations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ tutorId, date, hour })
  });
  const r = (await handle(res)) as Reservation;
  r.status = normalizeReservationStatus(r.status);
  return r;
}

/** Mis reservas (estudiante) en rango [from,to] */
export async function getMyReservations(from: string, to: string, token?: string): Promise<Reservation[]> {
  const url = `${BASE}/api/reservations/my?from=${from}&to=${to}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  const arr = (await handle(res)) as Reservation[];
  return arr.map(r => ({ ...r, status: normalizeReservationStatus(r.status) }));
}

/** Reservas para mí (como tutor) en rango - SIN NORMALIZAR EL STATUS */
export async function getTutorReservations(from: string, to: string, token?: string): Promise<Reservation[]> {
  const url = `${BASE}/api/reservations/for-me?from=${from}&to=${to}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  const arr = (await handle(res)) as Reservation[];
  // NO normalizar el status aquí - dejarlo como viene del backend
  return arr;
}

/** Cancelar reserva */
export async function cancelReservation(id: string, token?: string): Promise<Reservation> {
  const url = `${BASE}/api/reservations/${id}/cancel`;
  const res = await fetch(url, { method: 'PATCH', headers: headers(token) });
  const r = (await handle(res)) as Reservation;
  r.status = normalizeReservationStatus(r.status);
  return r;
}

/** Aceptar reserva (tutor) */
export async function acceptReservation(id: string, token?: string): Promise<Reservation> {
  const url = `${BASE}/api/reservations/${id}/accept`;
  const res = await fetch(url, { method: 'PATCH', headers: headers(token) });
  const r = (await handle(res)) as Reservation;
  r.status = normalizeReservationStatus(r.status);
  return r;
}
/** Marcar asistencia */
export async function setReservationAttended(id: string, value: boolean, token?: string): Promise<Reservation> {
  const url = `${BASE}/api/reservations/${id}/attended?value=${value ? 'true' : 'false'}`;
  const res = await fetch(url, { method: 'PATCH', headers: headers(token) });
  const r = (await handle(res)) as Reservation;
  r.status = normalizeReservationStatus(r.status);
  return r;
}

/** Reemplazar disponibilidad de un día (tutor) */
export async function replaceDayAvailability(date: string, hours: string[], token?: string): Promise<void> {
  const url = `${BASE}/api/availability/day/${date}`;
  const res = await fetch(url, { method: 'PUT', headers: headers(token), body: JSON.stringify({ hours }) });
  await handle(res);
}

/** Agregar disponibilidad (tutor) */
export async function addAvailability(
  date: string,
  hours: string[],
  token?: string
): Promise<{ addedCount: number; requestedCount: number; date: string; message: string; }> {
  const url = `${BASE}/api/availability/add`;
  const res = await fetch(url, { method: 'POST', headers: headers(token), body: JSON.stringify({ date, hours }) });
  return handle(res);
}

/** Disponibilidad pública (usada por BookTutorPage) con normalización + vencidas */
export async function getPublicAvailabilityForTutor(
  tutorId: string,
  weekStart: string,
  token?: string
): Promise<ScheduleCell[]> {
  const url = `${BASE}/api/availability/tutor/${encodeURIComponent(tutorId)}?weekStart=${weekStart}`;
  const res = await fetch(url, { method: 'GET', headers: headers(token) });
  const raw = (await handle(res)) as ScheduleCell[];

  // normalizamos ACTIVA a PENDIENTE y marcamos vencidas
  const mapped = raw.map(c => {
    const hhmm = norm(c.hour);
    const st = normalizeCellStatus(c.status);
    const expired = st === 'DISPONIBLE' && isPastSlot(c.date, hhmm);
    return { ...c, hour: hhmm, status: expired ? 'VENCIDA' : st };
  });

  return mapped;
}

export async function clearDayAvailability(date: string, token?: string): Promise<void> {
  const url = `${BASE}/api/availability/day/${date}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ hours: [] }),   
  });
  await handle(res);
}