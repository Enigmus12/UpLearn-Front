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
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5); // HH:mm o HH:mm:ss
}

// Configuración de endpoints de usuario
const USERS_BASE = ENV.USERS_BASE;                 // p.ej. http://localhost:8080/Api-user
const PROFILE_PATH = ENV.USERS_PROFILE_PATH;       // p.ej. /public/profile

// Perfil público mínimo
type PublicProfile = {
  id?: string;
  sub?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
};
// Grupo de reservas por estudiante
type StudentGroup = {
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  reservations: Reservation[];
};
// Página de gestión de clases del tutor
const TutorClassesPage: React.FC = () => {
  const auth = useAuth();
  const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
  // Estado de reservas
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] =
    useState<'all' | 'ACTIVA' | 'ACEPTADO' | 'CANCELADO'>('all');

  // Caché en memoria de perfiles por id
  const [profilesById, setProfilesById] = useState<Record<string, PublicProfile>>({});
  // Cargar reservas
  const load = useCallback(async () => {
    if (!token) {
      setMessage('⚠️ No hay sesión activa');
      return;
    }
    setLoading(true);
    try {
      // últimos 30 días y próximos 60
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      const to = new Date(today);
      to.setDate(to.getDate() + 60);
      //  Formatear a YYYY-MM-DD
      const fromStr = from.toISOString().slice(0, 10);
      const toStr = to.toISOString().slice(0, 10);
      // Obtener reservas
      const data = await getTutorReservations(fromStr, toStr, token);
      setReservations(data);
      setMessage(data.length === 0 ? 'ℹ️ No tienes clases programadas' : null);
    } catch (e: any) {
      console.error('Error cargando reservas:', e);
      setMessage('❌ ' + (e.message || 'Error cargando clases'));
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [token]);
  // Cargar reservas al montar
  useEffect(() => { load(); }, [load]);
  // Aceptar clase
  const handleAccept = async (reservationId: string) => {
    if (!token) return;
    if (!globalThis.confirm('¿Aceptar esta clase?')) return;
    try {
      await acceptReservation(reservationId, token);
      setMessage('✅ Clase aceptada correctamente');
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error aceptando clase'));
    }
  };
  // Cancelar clase
  const handleCancel = async (reservationId: string) => {
    if (!token) return;
    if (!globalThis.confirm('¿Cancelar esta clase? Esta acción no se puede deshacer.')) return;
    try {
      await cancelReservation(reservationId, token);
      setMessage('✅ Clase cancelada correctamente');
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error cancelando clase'));
    }
  };
  // Colores y textos de estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVA': return '#F59E0B';
      case 'ACEPTADO': return '#10B981';
      case 'CANCELADO': return '#EF4444';
      default: return '#6B7280';
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVA': return 'PENDIENTE';
      case 'ACEPTADO': return 'ACEPTADA';
      case 'CANCELADO': return 'CANCELADA';
      default: return status;
    }
  };
  // Filtrar reservas según estado
  const filteredReservations =
    filterStatus === 'all' ? reservations : reservations.filter(r => r.status === filterStatus);

  // Enriquecimiento en cliente: traer perfiles (si no están en caché) por cada studentId único 
  useEffect(() => {
    // Tomamos TODOS los studentId presentes en la vista actual (sin depender de si viene o no nombre)
    const idsToFetch = Array.from(
      new Set(filteredReservations.map(r => r.studentId))
    ).filter(id => !!id && !profilesById[id]); // sólo los que no están en caché
    // Si no hay IDs para buscar, salir
    if (idsToFetch.length === 0) return;

    let cancelled = false;
    // Hacer fetch de perfiles públicos
    (async () => {
      try {
        const results = await Promise.allSettled(
          idsToFetch.map(async (id) => {
            const url = `${USERS_BASE}${PROFILE_PATH}?sub=${encodeURIComponent(id)}&id=${encodeURIComponent(id)}`;

            //  si hay token, lo mandamos; si el endpoint era realmente público, lo ignora
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            //  si hay token, lo mandamos; si el endpoint era realmente público, lo ignora  
            const resp = await fetch(url, { headers });   // credentials: 'omit' (por defecto)
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            //  si hay token, lo mandamos; si el endpoint era realmente público, lo ignora
            const raw = await resp.json();
            return {
              id,
              profile: {
                id: raw?.id,
                sub: raw?.sub,
                name: raw?.name || raw?.fullName || raw?.displayName || raw?.username || raw?.email || '',
                email: raw?.email,
                avatarUrl: raw?.avatarUrl,
              },
            };
          })
        );

        // Si el efecto fue cancelado, no hacer nada
        if (cancelled) return;
        // Construir mapa de id → perfil
        const next: Record<string, PublicProfile> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') next[r.value.id] = r.value.profile;
        }
        if (Object.keys(next).length > 0) {
          setProfilesById(prev => ({ ...prev, ...next }));
        }
      } catch (e) {
        // silencioso: si falla, mantenemos el fallback “Estudiante”
        console.warn('No se pudieron enriquecer perfiles públicos', e);
      }
    })();
    // Cleanup por si cambia filteredReservations antes de completar fetch
    return () => { cancelled = true; };
  }, [filteredReservations, profilesById, USERS_BASE, PROFILE_PATH]);


  // Agrupar por estudiante con “ascenso” de nombre/avatar (reserva o perfil público)
  const studentGroups = useMemo(() => {
    const acc: Record<string, StudentGroup> = {};
    // Recorremos las reservas filtradas
    for (const res of filteredReservations) {
      const key = res.studentId;
      const p = profilesById[key];
      const name = (res.studentName?.trim()) || (p?.name?.trim());
      const avatar = res.studentAvatar ?? p?.avatarUrl;
      // Si ya existe el grupo, hacer “ascenso” de datos si es necesario
      if (acc[key]) {
        if ((!acc[key].studentName || acc[key].studentName === 'Estudiante') && name) {
          acc[key].studentName = name;
        }
        if (!acc[key].studentAvatar && avatar) {
          acc[key].studentAvatar = avatar;
        }
      } else {
        acc[key] = {
          studentId: res.studentId,
          studentName: name || 'Estudiante',
          studentAvatar: avatar,
          reservations: []
        };
      }
      acc[key].reservations.push(res);
    }
    return Object.values(acc);
  }, [filteredReservations, profilesById]);

  // stats
  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'ACTIVA').length,
    accepted: reservations.filter(r => r.status === 'ACEPTADO').length,
    cancelled: reservations.filter(r => r.status === 'CANCELADO').length,
  };

  if (loading && reservations.length === 0) {
    return (
      <div className="page" style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Mis Clases 🎓</h1>
        <p>⏳ Cargando clases...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Mis Clases 🎓</h1>

      {message && (() => {
        let background;
        let border;
        let color;
        if (message.includes('✅')) {
          background = '#ECFDF5';
          border = '1px solid #A7F3D0';
          color = '#065F46';
        } else if (message.includes('❌')) {
          background = '#FEF2F2';
          border = '1px solid #FECACA';
          color = '#991B1B';
        } else {
          background = '#FFF7ED';
          border = '1px solid #FED7AA';
          color = '#92400E';
        }
        return (
          <div style={{
            margin: '12px 0', padding: '12px 16px',
            background,
            border,
            borderRadius: '8px',
            color,
            fontWeight: 500
          }}>
            {message}
          </div>
        );
      })()}

      {/* Estadísticas */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px', marginBottom: '24px'
      }}>
        <div className="stat-card"><div className="stat-icon">📊</div><div className="stat-info"><h3>{stats.total}</h3><p>Total Clases</p></div></div>
        <div className="stat-card"><div className="stat-icon">⏳</div><div className="stat-info"><h3>{stats.pending}</h3><p>Pendientes</p></div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info"><h3>{stats.accepted}</h3><p>Aceptadas</p></div></div>
        <div className="stat-card"><div className="stat-icon">❌</div><div className="stat-info"><h3>{stats.cancelled}</h3><p>Canceladas</p></div></div>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '16px',
        padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB'
      }}>
        <span style={{ fontWeight: 600, marginRight: '8px', alignSelf: 'center' }}>Filtrar:</span>
        {(['all', 'ACTIVA', 'ACEPTADO', 'CANCELADO'] as const).map(status => (
          <button
            key={status}
            className={`btn-modern ${filterStatus === status ? 'btn-primary-modern' : 'btn-secondary-modern'}`}
            onClick={() => setFilterStatus(status)}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {status === 'all' ? 'Todas' : getStatusText(status)}
          </button>
        ))}
        <button className="btn-modern btn-secondary-modern" onClick={load} disabled={loading}
          style={{ marginLeft: 'auto', fontSize: '13px', padding: '6px 12px' }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Lista agrupada por estudiante */}
      {studentGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#F9FAFB', borderRadius: '12px', color: '#6B7280' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>📭</p>
          <p>No hay clases {filterStatus === 'all' ? '' : `con estado "${getStatusText(filterStatus)}"`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {studentGroups.map(group => {
            const sortedReservations = [...group.reservations].sort((a, b) => {
              const aTime = new Date(a.date + 'T' + (a.start.length === 5 ? a.start + ':00' : a.start)).getTime();
              const bTime = new Date(b.date + 'T' + (b.start.length === 5 ? b.start + ':00' : b.start)).getTime();
              return aTime - bTime;
            });

            return (
              <div key={group.studentId}
                style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
                  paddingBottom: '12px', borderBottom: '2px solid #F3F4F6'
                }}>
                  {group.studentAvatar ? (
                    <img src={group.studentAvatar} alt={group.studentName}
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div aria-hidden
                      style={{
                        width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700
                      }}>
                      {(group.studentName || 'E').trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{group.studentName}</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                      {group.reservations.length} clase{group.reservations.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sortedReservations.map(res => (
                    <div key={res.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'center',
                        padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB'
                      }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                          📅 {formatDate(res.date)} • 🕐 {formatTime(res.start)} - {formatTime(res.end)}
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                          ID: {res.id.slice(0, 8)}...
                        </p>
                      </div>

                      <div>
                        <span className="status-badge"
                          style={{
                            color: getStatusColor(res.status), fontWeight: 700, fontSize: '12px',
                            padding: '4px 12px', background: `${getStatusColor(res.status)}15`, borderRadius: '999px'
                          }}>
                          {getStatusText(res.status)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {res.status === 'ACTIVA' && (
                          <>
                            <button className="btn btn-primary" onClick={() => handleAccept(res.id)}
                              style={{ fontSize: '13px', padding: '6px 12px', height: '36px' }}>✓ Aceptar</button>
                            <button className="btn btn-danger" onClick={() => handleCancel(res.id)}
                              style={{ fontSize: '13px', padding: '6px 12px', height: '36px', marginTop: '8px' }}>✗ Cancelar</button>
                          </>
                        )}
                        {res.status === 'ACEPTADO' && (
                          <button className="btn btn-danger" onClick={() => handleCancel(res.id)}
                            style={{ fontSize: '13px', padding: '6px 12px', height: '36px' }}>Cancelar</button>
                        )}
                        {res.status === 'CANCELADO' && (
                          <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Clase cancelada</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TutorClassesPage;
