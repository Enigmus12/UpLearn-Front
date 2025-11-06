import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import '../styles/Calendar.css';
import '../styles/StudentDashboard.css';
import {
  getScheduleForTutor,
  getPublicAvailabilityForTutor,
  createReservation,
  type ScheduleCell,
} from '../service/Api-scheduler';
import { TutorTopNav } from './TutorDashboard';

function parseISODateLocal(iso: string): Date {
  // iso = 'YYYY-MM-DD'
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1); // fecha local
}
function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function mondayOf(dateIso: string): string {
  const d = parseISODateLocal(dateIso);
  const day = d.getDay(); // 0=Dom,1=Lun,...,6=Sab
  const diffFromMonday = (day + 6) % 7; // Lun->0, Mar->1, ..., Dom->6
  d.setDate(d.getDate() - diffFromMonday);
  return toISODateLocal(d);
}
function addDays(iso: string, days: number): string {
  const d = parseISODateLocal(iso);
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

/* Estado esperado en la navegación */
interface NavState {
  tutor?: {
    userId?: string;
    sub?: string;
    name?: string;
    email?: string;
    bio?: string;
    specializations?: string[];
    credentials?: string[];
  };
  role?: 'tutor' | 'student';
}

/* Banner */
type BannerType = 'success' | 'warning' | 'error';
type Banner = { type: BannerType; text: string } | null;
const bannerStyle = (type: BannerType): React.CSSProperties => {
  if (type === 'success') {
    return {
      margin: '12px 0',
      padding: '12px 16px',
      background: '#ECFDF5',
      border: '1px solid #A7F3D0',
      borderRadius: '8px',
      color: '#065F46',
      fontWeight: 500,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    };
  }
  if (type === 'warning') {
    return {
      margin: '12px 0',
      padding: '12px 16px',
      background: '#FFFBEB',
      border: '1px solid #FDE68A',
      borderRadius: '8px',
      color: '#92400E',
      fontWeight: 500,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    };
  }
  return {
    margin: '12px 0',
    padding: '12px 16px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '8px',
    color: '#991B1B',
    fontWeight: 500,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  };
};

const BookTutorPage: React.FC = () => {
  const { tutorId } = useParams<{ tutorId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  // Datos del tutor y rol desde la navegación
  const state = location.state as NavState | undefined;
  const profile = state?.tutor ?? {};
  const role: 'tutor' | 'student' = state?.role ?? 'tutor';

  // Estado local
  const [token, setToken] = useState<string | undefined>();
  const [weekStart, setWeekStart] = useState(() => mondayOf(toISODateLocal(new Date())));
  const [scheduleCells, setScheduleCells] = useState<ScheduleCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<ScheduleCell | null>(null);
  const [loading, setLoading] = useState(false);

  // Banner
  const [banner, setBanner] = useState<Banner>(null);

  // Menú usuario (solo avatar, sin menú de navegación duplicado)
  const [showUserMenu, setShowUserMenu] = useState(false);
  const currentUser = useMemo(
    () => ({
      name: auth.user?.profile?.name || auth.user?.profile?.nickname || 'Usuario',
      email: auth.user?.profile?.email || 'No email',
    }),
    [auth.user]
  );

  // Auth token
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const idToken = (auth.user as any)?.id_token as string | undefined;
      const accessToken = auth.user?.access_token as string | undefined;
      setToken(idToken ?? accessToken);
    } else {
      setToken(undefined);
    }
  }, [auth.isAuthenticated, auth.user]);

  // Identificador efectivo del tutor
  const effectiveTutorId = useMemo(
    () => (profile as any)?.userId || (profile as any)?.sub || tutorId,
    [profile, tutorId]
  );

  // Cargar disponibilidad/semanas con weekStart anclado a LUNES (evita “dos días nulos”)
  useEffect(() => {
    const loadWeek = async () => {
      if (!token || !effectiveTutorId) return;
      setLoading(true);
      setSelectedCell(null);
      setBanner(null);
      try {
        const data = await getScheduleForTutor(effectiveTutorId, weekStart, token);
        setScheduleCells(data);
      } catch {
        // fallback público si no hay endpoint privado
        const data = await getPublicAvailabilityForTutor(effectiveTutorId, weekStart, token);
        setScheduleCells(data);
      } finally {
        setLoading(false);
      }
    };
    loadWeek();
  }, [token, effectiveTutorId, weekStart]);

  // Confirmar reserva
  const confirmReservation = async () => {
    if (!selectedCell || !token || !effectiveTutorId) return;

    // Evitar reservarse a sí mismo
    const myId = auth.user?.profile?.sub;
    if (myId && effectiveTutorId && myId === effectiveTutorId) {
      setBanner({ type: 'warning', text: 'No te puedes reservar a ti mismo.' });
      return;
    }
    const ok = globalThis.confirm(
      `Confirmar reserva el ${selectedCell.date} a las ${selectedCell.hour}?`
    );
    if (!ok) return;

    try {
      await createReservation(effectiveTutorId, selectedCell.date, selectedCell.hour, token);
      setBanner({ type: 'success', text: '¡Reserva creada correctamente!' });
      setTimeout(
        () => navigate('/student-dashboard?tab=my-reservations', { replace: true }),
        900
      );
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('tutor no puede ser el mismo') || msg.includes('no puede ser el mismo que el estudiante')) {
        setBanner({ type: 'warning', text: 'No te puedes reservar a ti mismo.' });
      } else {
        setBanner({ type: 'error', text: e?.message || 'Error creando la reserva.' });
      }
    }
  };

  // Icono del banner extraído a una declaración independiente 
  let bannerIcon = '';
  if (banner) {
    if (banner.type === 'success') {
      bannerIcon = '✅';
    } else if (banner.type === 'warning') {
      bannerIcon = '⚠️';
    } else {
      bannerIcon = '❌';
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <h2>UpLearn Student</h2>
          </div>

          {/* ✅ Sin menú de navegación propio.
              Importamos el TopNav reutilizable para evitar duplicación. */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TutorTopNav currentRole="student" />

            <div className="user-menu-container">
              <button className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
                <span className="avatar-icon">👤</span>
                <span className="user-name">{currentUser.name}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <p className="user-email">{currentUser.email}</p>
                    <p className="user-role">Estudiante</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button
                    className="dropdown-item"
                    onClick={() => navigate('/edit-profile', { state: { currentRole: 'student' } })}
                  >
                    <span>✏️</span> Editar Perfil
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      auth.removeUser();
                      navigate('/login');
                    }}
                  >
                    <span>🚪</span> Cerrar Sesión (Local)
                  </button>
                  <button
                    className="dropdown-item logout"
                    onClick={() => {
                      const clientId = 'lmk8qk12er8t8ql9phit3u12e';
                      const logoutUri = 'http://localhost:3000';
                      const cognitoDomain = 'https://us-east-1splan606f.auth.us-east-1.amazoncognito.com';
                      globalThis.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
                    }}
                  >
                    <span>🔐</span> Cerrar Sesión (Cognito)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="dashboard-main">
        <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
          {/* Banner de mensajes */}
          {banner && (
            <div style={bannerStyle(banner.type)}>
              <span aria-hidden>
                {bannerIcon}
              </span>
              <span>{banner.text}</span>
            </div>
          )}

          {/* Tarjeta compacta del tutor */}
          <section className="card compact-profile">
            <div className="compact-profile__left">
              <div className="avatar-bubble">👨‍🏫</div>
            </div>
            <div className="compact-profile__body">
              <h2 className="compact-profile__name">{(profile as any).name ?? 'Usuario'}</h2>

              {role === 'student' ? (
                <div className="compact-profile__block">
                  <h4>Información académica</h4>
                  <div>• Nivel educativo: {(profile as any)?.educationLevel ?? '—'}</div>
                </div>
              ) : (
                <>
                  {(profile as any).bio && (
                    <div className="compact-profile__block">
                      <h4>Biografía</h4>
                      <p>{(profile as any).bio}</p>
                    </div>
                  )}
                  <div className="compact-profile__block">
                    <h4>Especializaciones</h4>
                    <div className="tags-container">
                      {(profile as any).specializations?.length
                        ? (profile as any).specializations.map((s: string) => (
                            <span key={s} className="tag">{s}</span>
                          ))
                        : '—'}
                    </div>
                  </div>
                  <div className="compact-profile__block">
                    <h4>Credenciales</h4>
                    <div className="tags-container">
                      {(profile as any).credentials?.length
                        ? (profile as any).credentials.map((c: string) => (
                            <span key={c} className="tag">{c}</span>
                          ))
                        : '—'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Resumen + acciones */}
          <section className="card action-strip">
            <div className="action-strip__left">
              {selectedCell
                ? <>Seleccionado: <strong>{selectedCell.date} {selectedCell.hour}</strong></>
                : 'Selecciona una hora disponible'}
            </div>
            <div className="action-strip__right">
              <button className="btn btn-secondary" onClick={() => navigate(-1)}>Volver</button>
              <button className="btn btn-primary" onClick={confirmReservation} disabled={!selectedCell}>
                Confirmar Reserva
              </button>
            </div>
          </section>

          {/* Navegación de semana (siempre de LUN a DOM) */}
          <section className="card week-nav week-nav--highlight">
            <button className="btn btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ◀ Semana anterior
            </button>
            <div className="week-nav__title">
              Semana {weekStart} — {addDays(weekStart, 6)}
            </div>
            <button className="btn btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Siguiente semana ▶
            </button>
          </section>

          {/* Calendario */}
          <section className="calendar-container card" style={{ padding: 12 }}>
            {loading ? (
              <div style={{ padding: 20 }}>Cargando disponibilidad...</div>
            ) : (
              <div className="calendar-grid">
                <div className="col hour-col">
                  <div className="head-cell">Hora</div>
                  {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00').map(h => (
                    <div key={h} className="hour-cell">{h}</div>
                  ))}
                </div>

                {Array.from({ length: 7 }, (_, i) => i).map(i => {
                  const date = addDays(weekStart, i);
                  return (
                    <div key={date} className="col">
                      <div className="head-cell">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i]}<br />{date.slice(5)}
                      </div>

                      {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00').map(h => {
                        const c = scheduleCells.find(k => k.date === date && k.hour === h);
                        const st = ((c?.status ?? '') as string).toUpperCase();

                        const pickable = st === 'DISPONIBLE' || st === 'AVAILABLE';
                        const isSelected = selectedCell?.date === date && selectedCell?.hour === h;
                        const key = `${date}_${h}`;

                        let statusClass = 'disabled';
                        if (st) statusClass = pickable ? 'available' : 'taken';

                        let ariaLabel = `No disponible ${h} ${date}`;
                        if (pickable) ariaLabel = `Disponible ${h} ${date}`;
                        else if (st) ariaLabel = `Ocupado ${h} ${date}`;

                        return (
                          <button
                            type="button"
                            key={key}
                            className={
                              'cell ' +
                              statusClass +
                              (pickable ? ' can-pick' : '') +
                              (isSelected ? ' selected' : '')
                            }
                            onClick={
                              pickable
                                ? () => {
                                    setSelectedCell({
                                      date,
                                      hour: h,
                                      status: 'DISPONIBLE',
                                      reservationId: null,
                                      studentId: null,
                                    });
                                    setBanner(null);
                                  }
                                : undefined
                            }
                            disabled={!pickable}
                            aria-pressed={isSelected}
                            aria-label={ariaLabel}
                          >
                            {pickable && <span className="cell-label">Disponible</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default BookTutorPage;
