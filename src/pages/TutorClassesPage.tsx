import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import {
  acceptReservation,
  cancelReservation,
  getTutorReservations,
  type Reservation,
} from '../service/Api-scheduler';
import '../styles/TutorDashboard.css';
import { ENV } from '../utils/env';
import { useNavigate } from 'react-router-dom';

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDate(anyDate: string | Date): string {
  let d: Date;
  if (typeof anyDate === 'string') {
    const appendTime = anyDate.length === 10 ? 'T00:00:00' : '';
    d = new Date(anyDate + appendTime);
  } else {
    d = anyDate;
  }
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatTime(timeStr: string): string {
  const s = (timeStr ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
}

function nowLocalISOStringDate(): string {
  return toISODateLocal(new Date());
}

function getEffectiveStatus(res: Reservation): string {
  const now = new Date();
  const [year, month, day] = res.date.split('-').map(Number);
  const [startHour, startMin] = formatTime(res.start).split(':').map(Number);
  const [endHour, endMin] = formatTime(res.end || res.start).split(':').map(Number);

  const startMs = new Date(year, month - 1, day, startHour, startMin, 0).getTime();
  const endMs = new Date(year, month - 1, day, endHour, endMin, 0).getTime();
  const nowMs = now.getTime();

  const raw = (res.status || '').toUpperCase();
  const tutorAttended = (res as any).tutorAttended;
  const studentAttended = (res as any).studentAttended;
  const attendedAny = (res as any).attended;

  const explicitFinished = raw === 'FINALIZADA' || raw === 'COMPLETADA' || raw === 'ASISTIDA';
  const explicitMissed = raw === 'INCUMPLIDA';
  const explicitCanceled = raw === 'CANCELADO';

  const bothAttendedTrue = (tutorAttended === true && studentAttended === true) || attendedAny === true;
  const anyDidNotAttend = tutorAttended === false || studentAttended === false || attendedAny === false;

  const checks: Array<[() => boolean, string]> = [
    [() => explicitCanceled, 'CANCELADO'],
    [() => explicitFinished, 'FINALIZADA'],
    [() => explicitMissed, 'INCUMPLIDA'],
    [() => raw === 'ACEPTADO' && nowMs >= startMs && nowMs <= endMs, 'ACTIVA'],
    [() => nowMs > endMs && raw === 'ACEPTADO' && bothAttendedTrue, 'FINALIZADA'],
    [() => nowMs > endMs && raw === 'ACEPTADO' && anyDidNotAttend, 'INCUMPLIDA'],
    [() => nowMs > endMs && raw === 'PENDIENTE', 'VENCIDA'],
    [() => raw === 'PENDIENTE', 'PENDIENTE'],
    [() => raw === 'ACEPTADO', 'ACEPTADO'],
  ];

  for (const [pred, result] of checks) {
    try {
      if (pred()) return result;
    } catch {
      // ignore predicate errors and continue
    }
  }

  return raw || 'DESCONOCIDO';
}

const USERS_BASE = ENV.USERS_BASE;
const PROFILE_PATH = ENV.USERS_PROFILE_PATH;

type PublicProfile = {
  id?: string;
  sub?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
};

type StudentGroup = {
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  reservations: Reservation[];
};

const TutorClassesPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const token = (auth.user as any)?.id_token ?? auth.user?.access_token;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] =
    useState<'all' | 'PENDIENTE' | 'ACEPTADO' | 'ACTIVA' | 'FINALIZADA' | 'INCUMPLIDA' | 'VENCIDA'>('all');
  const [query, setQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [profilesById, setProfilesById] = useState<Record<string, PublicProfile>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<5 | 10 | 20>(5);

  const norm = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const load = useCallback(async () => {
    if (!token) {
      setMessage('⚠️ No hay sesión activa');
      return;
    }
    setLoading(true);
    try {
      const today = new Date();
      const from = new Date(today); from.setDate(from.getDate() - 30);
      const to = new Date(today); to.setDate(to.getDate() + 60);
      const fromStr = toISODateLocal(from);
      const toStr = toISODateLocal(to);

      const data = await getTutorReservations(fromStr, toStr, token);
      const visible = data.filter(r => r.status !== 'CANCELADO');
      visible.sort((a, b) => {
        const aTime = new Date(`${a.date}T${formatTime(a.start)}:00`);
        const bTime = new Date(`${b.date}T${formatTime(b.start)}:00`);
        return aTime.getTime() - bTime.getTime();
      });

      setReservations(visible);
      setMessage(visible.length === 0 ? 'ℹ️ No tienes clases visibles' : null);
      setPage(1);
    } catch (e: any) {
      console.error('Error cargando reservas:', e);
      setMessage('❌ ' + (e.message || 'Error cargando clases'));
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (reservationId: string) => {
    if (!token || !globalThis.confirm('¿Aceptar esta clase?')) return;
    try {
      await acceptReservation(reservationId, token);
      setMessage('✅ Clase aceptada correctamente');
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error aceptando clase'));
    }
  };

  const handleCancel = async (reservationId: string) => {
    if (!token || !globalThis.confirm('¿Cancelar esta clase? Esta acción no se puede deshacer.')) return;
    try {
      await cancelReservation(reservationId, token);
      setMessage('✅ Clase cancelada correctamente');
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error cancelando clase'));
    }
  };

  const getStatusColor = (status?: string | null) => ({
    'PENDIENTE': '#F59E0B',
    'ACEPTADO': '#10B981',
    'ACTIVA': '#6366F1',
    'FINALIZADA': '#0EA5E9',
    'INCUMPLIDA': '#F97316',
    'VENCIDA': '#9CA3AF',
  }[String(status || '').toUpperCase()] || '#6B7280');

  const getStatusText = (status?: string | null) => ({
    'PENDIENTE': 'PENDIENTE',
    'ACEPTADO': 'ACEPTADA',
    'ACTIVA': 'ACTIVA',
    'FINALIZADA': 'FINALIZADA',
    'INCUMPLIDA': 'INCUMPLIDA',
    'VENCIDA': 'VENCIDA',
  }[String(status || '').toUpperCase()] || '—');

  const reservationsFiltered = (() => {
    let result = reservations.map(r => ({ ...r, effectiveStatus: getEffectiveStatus(r) }));

    if (filterStatus !== 'all') {
      result = result.filter(r => r.effectiveStatus === filterStatus);
    }
    if (!showPast) {
      const now = new Date();
      result = result.filter(r => {
        const [year, month, day] = r.date.split('-').map(Number);
        const [endHour, endMin] = formatTime(r.end || r.start).split(':').map(Number);
        const endTime = new Date(year, month - 1, day, endHour, endMin, 0);
        return endTime.getTime() >= now.getTime();
      });
    }
    return result;
  })();

  useEffect(() => {
    const ids = Array.from(
      new Set(
        reservationsFiltered
          .map(r => (r as any).studentId as string | undefined)
          .filter(Boolean) as string[]
      )
    ).filter(id => !profilesById[id]);

    if (ids.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.allSettled(
          ids.map(async (id) => {
            const url = `${USERS_BASE}${PROFILE_PATH}?sub=${encodeURIComponent(id)}&id=${encodeURIComponent(id)}`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const raw = await resp.json();
            const prof: PublicProfile = {
              id: raw?.id,
              sub: raw?.sub,
              name: raw?.name || raw?.fullName || raw?.displayName || raw?.username || raw?.email || '',
              email: raw?.email,
              avatarUrl: raw?.avatarUrl
            };
            return { id, prof };
          })
        );

        if (cancelled) return;
        const next: Record<string, PublicProfile> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') next[r.value.id] = r.value.prof;
        }
        if (Object.keys(next).length > 0) setProfilesById(prev => ({ ...prev, ...next }));
      } catch {
      }
    })();

    return () => { cancelled = true; };
  }, [reservationsFiltered, profilesById, token]);

  const groupsAll: StudentGroup[] = useMemo(() => {
    const acc: Record<string, StudentGroup> = {};
    for (const res of reservationsFiltered) {
      const sid = (res as any).studentId || 'desconocido';
      const p = profilesById[sid];
      const name = (res as any).studentName?.trim() || p?.name?.trim() || 'Estudiante';
      const avatar = (res as any).studentAvatar ?? p?.avatarUrl;

      if (acc[sid] === undefined) {
        acc[sid] = { studentId: sid, studentName: name, studentAvatar: avatar, reservations: [] };
      } else {
        if ((!acc[sid].studentName || acc[sid].studentName === 'Estudiante') && name) acc[sid].studentName = name;
        if (!acc[sid].studentAvatar && avatar) acc[sid].studentAvatar = avatar;
      }
      acc[sid].reservations.push(res);
    }
    for (const g of Object.values(acc)) {
      g.reservations.sort((a, b) => {
        const [aYear, aMonth, aDay] = a.date.split('-').map(Number);
        const [aHour, aMin] = formatTime(a.start).split(':').map(Number);
        const aTime = new Date(aYear, aMonth - 1, aDay, aHour, aMin, 0);
        
        const [bYear, bMonth, bDay] = b.date.split('-').map(Number);
        const [bHour, bMin] = formatTime(b.start).split(':').map(Number);
        const bTime = new Date(bYear, bMonth - 1, bDay, bHour, bMin, 0);
        
        return aTime.getTime() - bTime.getTime();
      });
    }
    return Object.values(acc).sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
  }, [reservationsFiltered, profilesById]);

  const groupsFiltered = useMemo(() => {
    if (!query.trim()) return groupsAll;
    const q = norm(query);
    return groupsAll.filter(g => norm(g.studentName).includes(q));
  }, [groupsAll, query]);

  const totalPages = Math.max(1, Math.ceil(groupsFiltered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * pageSize;
  const end = start + pageSize;
  const groupsPage = groupsFiltered.slice(start, end);

  useEffect(() => { setPage(1); }, [filterStatus, query, pageSize, showPast]);

  const handleContact = (studentId: string, studentName: string) =>
    navigate(`/messages?to=${encodeURIComponent(studentId)}&name=${encodeURIComponent(studentName)}`);

  if (loading && reservations.length === 0) {
    return (
      <div className="page" style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Mis Clases 🎓</h1>
        <p>⏳ Cargando clases...</p>
      </div>
    );
  }

  const badge = (msg: string) => {
    let background, border, color;
    if (msg.includes('✅')) { background = '#ECFDF5'; border = '1px solid #A7F3D0'; color = '#065F46'; }
    else if (msg.includes('❌')) { background = '#FEF2F2'; border = '1px solid #FECACA'; color = '#991B1B'; }
    else { background = '#FFF7ED'; border = '1px solid #FED7AA'; color = '#92400E'; }
    return (
      <div style={{ margin: '12px 0', padding: '12px 16px', background, border, borderRadius: '8px', color, fontWeight: 500 }}>
        {msg}
      </div>
    );
  };

  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => getEffectiveStatus(r) === 'PENDIENTE').length,
    accepted: reservations.filter(r => getEffectiveStatus(r) === 'ACEPTADO').length,
    active: reservations.filter(r => getEffectiveStatus(r) === 'ACTIVA').length,
    finished: reservations.filter(r => getEffectiveStatus(r) === 'FINALIZADA').length,
    missed: reservations.filter(r => getEffectiveStatus(r) === 'INCUMPLIDA').length,
    expired: reservations.filter(r => getEffectiveStatus(r) === 'VENCIDA').length,
  };

  return (
    <div className="page" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Mis Clases 🎓</h1>

      {message && badge(message)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card"><div className="stat-icon">📊</div><div className="stat-info"><h3>{stats.total}</h3><p>Total Clases</p></div></div>
        <div className="stat-card"><div className="stat-icon">⏳</div><div className="stat-info"><h3>{stats.pending}</h3><p>Pendientes</p></div></div>
        <div className="stat-card"><div className="stat-icon">▶️</div><div className="stat-info"><h3>{stats.active}</h3><p>Activas</p></div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><h3>{stats.accepted}</h3><p>Aceptadas</p></div></div>
        <div className="stat-card"><div className="stat-icon">🏁</div><div className="stat-info"><h3>{stats.finished}</h3><p>Finalizadas</p></div></div>
        <div className="stat-card"><div className="stat-icon">⚠️</div><div className="stat-info"><h3>{stats.missed}</h3><p>Incumplidas</p></div></div>
        <div className="stat-card"><div className="stat-icon">⏲️</div><div className="stat-info"><h3>{stats.expired}</h3><p>Vencidas</p></div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', marginBottom: '16px', padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="search" style={{ fontWeight: 600 }}>Buscar:</label>
          <input id="search" type="text" placeholder="Nombre del estudiante..." value={query} onChange={(e) => setQuery(e.target.value)} className="form-input" style={{ padding: '8px 10px', minWidth: 240 }} />
          <label style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} /> Ver pasadas
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifySelf: 'end' }}>
          <label htmlFor="status" style={{ fontWeight: 600 }}>Estado:</label>
          <select id="status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="form-select">
            <option value="all">Todas</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="ACEPTADO">Aceptada</option>
            <option value="ACTIVA">Activa</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="INCUMPLIDA">Incumplida</option>
            <option value="VENCIDA">Vencida</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifySelf: 'end' }}>
          <label htmlFor="pagesize" style={{ fontWeight: 600 }}>Estudiantes/página:</label>
          <select id="pagesize" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as any)} className="form-select">
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'end' }}>
          <button className="btn-modern btn-secondary-modern" onClick={load} disabled={loading}>🔄 Actualizar</button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-modern btn-secondary-modern" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe <= 1}>◀</button>
            <span style={{ fontSize: 13 }}>{pageSafe}/{totalPages}</span>
            <button className="btn-modern btn-secondary-modern" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>▶</button>
          </div>
        </div>
      </div>

      {groupsPage.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#F9FAFB', borderRadius: '12px', color: '#6B7280' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>📭</p>
          <p>No hay clases {filterStatus === 'all' ? '' : `con estado "${getStatusText(filterStatus)}"`}{query ? ` para "${query}"` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupsPage.map(group => (
            <div key={group.studentId} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #F3F4F6' }}>
                {group.studentAvatar ? (
                  <img src={group.studentAvatar} alt={group.studentName} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div aria-hidden style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                    {(group.studentName || 'E').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{group.studentName}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>{group.reservations.length} clase{group.reservations.length === 1 ? '' : 's'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {group.reservations.map((res: any) => {
                  const effectiveStatus = res.effectiveStatus;
                  const color = getStatusColor(effectiveStatus);
                  const bg = `${color}15`;
                  const canAccept = effectiveStatus === 'PENDIENTE';
                  const canCancel = effectiveStatus === 'PENDIENTE' || effectiveStatus === 'ACEPTADO';
                  const canContact = effectiveStatus === 'ACEPTADO' || effectiveStatus === 'ACTIVA';

                  return (
                    <div key={res.id} className="reservation-row">
                      <div className="reservation-info">
                        <p className="reservation-datetime">📅 {formatDate(res.date)} • 🕐 {formatTime(res.start)} - {formatTime(res.end)}</p>
                        <p className="reservation-id">ID: {String(res.id).slice(0, 8)}...{typeof res.attended === 'boolean' && (<span className="reservation-attended">{' '}• Asistencia: {res.attended ? 'Sí' : 'No'}</span>)}</p>
                      </div>

                      <div className="reservation-meta">
                        {effectiveStatus ? (<span className="status-badge" style={{ color, background: bg }}>{getStatusText(effectiveStatus)}</span>) : <span>—</span>}
                      </div>

                      <div className="reservation-actions">
                        <button className="btn btn-primary" onClick={() => handleAccept(res.id)} disabled={!canAccept} style={{ minHeight: 56 }}>✓ Aceptar</button>
                        <button className="btn btn-danger" onClick={() => handleCancel(res.id)} disabled={!canCancel}>✗ Cancelar</button>
                        <button className="btn" onClick={() => handleContact(group.studentId, group.studentName)} disabled={!canContact} style={{ background: canContact ? '#10B981' : undefined, color: canContact ? '#fff' : undefined }} title="Abrir chat con el estudiante" aria-disabled={!canContact}>💬 Contactar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TutorClassesPage;