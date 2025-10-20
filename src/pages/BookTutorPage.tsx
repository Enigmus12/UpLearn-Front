import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import '../styles/Calendar.css';
import '../styles/StudentDashboard.css';
import {
    getScheduleForTutor,
    getPublicAvailabilityForTutor,
    createReservation,
    type ScheduleCell,
} from '../service/Api-scheduler';
import DashboardSwitchButton from '../components/DashboardSwitchButton';
import AddRoleButton from '../components/AddRoleButton';

// Utilidades de fecha
function mondayOf(dateIso: string): string {
    const d = new Date(dateIso + 'T00:00:00');
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}
// Suma días a una fecha ISO
function addDays(iso: string, days: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
// Estado esperado en la navegación
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
// Página para reservar una sesión con un tutor
const BookTutorPage: React.FC = () => {
    const { tutorId } = useParams<{ tutorId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const auth = useAuth();
    // Datos del tutor y rol desde la navegación
    const state = location.state as NavState | undefined;
    const profile = state?.tutor ?? {};
    const role: 'tutor' | 'student' = state?.role ?? 'tutor';
    // Estados locales
    const [token, setToken] = useState<string | undefined>();
    const [weekStart, setWeekStart] = useState(() => mondayOf(new Date().toISOString().slice(0, 10)));
    const [scheduleCells, setScheduleCells] = useState<ScheduleCell[]>([]);
    const [selectedCell, setSelectedCell] = useState<ScheduleCell | null>(null);
    const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Menú usuario
    const [showUserMenu, setShowUserMenu] = useState(false);
    const currentUser = useMemo(
        () => ({
            name: auth.user?.profile?.name || auth.user?.profile?.nickname || 'Usuario',
            email: auth.user?.profile?.email || 'No email',
        }),
        [auth.user]
    );
    // Funciones de navegación y sesión
    const go = (tab: string) => navigate(`/student-dashboard?tab=${tab}`);
    const handleLogout = () => { auth.removeUser(); navigate('/login'); };
    const signOutRedirect = () => {
        const clientId = 'lmk8qk12er8t8ql9phit3u12e';
        const logoutUri = 'http://localhost:3000';
        const cognitoDomain = 'https://us-east-1splan606f.auth.us-east-1.amazoncognito.com';
        globalThis.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
    };
    // Identificador efectivo del tutor
    const effectiveTutorId = useMemo(
        () => (profile as any)?.userId || (profile as any)?.sub || tutorId,
        [profile, tutorId]
    );
    // Cargar token al autenticarse
    useEffect(() => {
        if (auth.isAuthenticated && auth.user) {
            const idToken = (auth.user as any)?.id_token as string | undefined;
            const accessToken = auth.user?.access_token as string | undefined;
            setToken(idToken ?? accessToken);
        } else {
            setToken(undefined);
        }
    }, [auth.isAuthenticated, auth.user]);
    // Cargar disponibilidad del tutor
    useEffect(() => {
        const loadWeek = async () => {
            if (!token || !effectiveTutorId) return;
            setLoading(true);
            setSelectedCell(null);
            setConfirmMsg(null);
            try {
                const data = await getScheduleForTutor(effectiveTutorId, weekStart, token);
                setScheduleCells(data);
            } catch {
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
        const ok = globalThis.confirm(`Confirmar reserva el ${selectedCell.date} a las ${selectedCell.hour}?`);
        if (!ok) return;
        await createReservation(effectiveTutorId, selectedCell.date, selectedCell.hour, token);
        setConfirmMsg('✅ ¡Reserva creada!');
        setTimeout(() => navigate('/student-dashboard?tab=my-reservations', { replace: true }), 900);
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="logo"><h2>UpLearn Student</h2></div>
                    <nav className="main-nav">
                        <button className="nav-item" onClick={() => go('dashboard')}><span>📊</span> Dashboard</button>
                        <button className="nav-item" onClick={() => go('find-tutors')}><span>🔍</span> Buscar Tutores</button>
                        <button className="nav-item" onClick={() => go('my-reservations')}><span>🗓️</span> Mis Reservas</button>
                        <button className="nav-item" onClick={() => go('my-tasks')}><span>📋</span> Mis Tareas</button>
                        <button className="nav-item" onClick={() => go('post-task')}><span>➕</span> Publicar Tarea</button>
                    </nav>
                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <DashboardSwitchButton currentRole="student" />
                        <AddRoleButton currentRole="student" />
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
                                    <button className="dropdown-item" onClick={() => navigate('/edit-profile', { state: { currentRole: 'student' } })}><span>✏️</span> Editar Perfil</button>
                                    <button className="dropdown-item" onClick={handleLogout}><span>🚪</span> Cerrar Sesión (Local)</button>
                                    <button className="dropdown-item logout" onClick={signOutRedirect}><span>🔐</span> Cerrar Sesión (Cognito)</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Contenido principal */}
            <main className="dashboard-main">
                <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
                    {/* Tarjeta compacta del tutor */}
                    <section className="card compact-profile">
                        <div className="compact-profile__left">
                            <div className="avatar-bubble">👨‍🏫</div>
                        </div>
                        <div className="compact-profile__body">
                            <h2 className="compact-profile__name">{profile.name ?? 'Usuario'}</h2>

                            {role === 'student' ? (
                                <div className="compact-profile__block">
                                    <h4>Información académica</h4>
                                    <div>• Nivel educativo: {(profile as any)?.educationLevel ?? '—'}</div>
                                </div>
                            ) : (
                                <>
                                    {profile.bio && (
                                        <div className="compact-profile__block">
                                            <h4>Biografía</h4>
                                            <p>{profile.bio}</p>
                                        </div>
                                    )}
                                    <div className="compact-profile__block">
                                        <h4>Especializaciones</h4>
                                        <div className="tags-container">
                                            {profile.specializations?.length
                                                ? profile.specializations.map((s) => <span key={s} className="tag">{s}</span>)
                                                : '—'}
                                        </div>
                                    </div>
                                    <div className="compact-profile__block">
                                        <h4>Credenciales</h4>
                                        <div className="tags-container">
                                            {profile.credentials?.length
                                                ? profile.credentials.map((c) => <span key={c} className="tag">{c}</span>)
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
                            {confirmMsg && <div style={{ marginTop: 6, color: 'green' }}>{confirmMsg}</div>}
                        </div>
                        <div className="action-strip__right">
                            <button className="btn btn-secondary" onClick={() => navigate(-1)}>Volver</button>
                            <button className="btn btn-primary" onClick={confirmReservation} disabled={!selectedCell}>
                                Confirmar Reserva
                            </button>
                        </div>
                    </section>

                    {/* Navegación de semana */}
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
                                {/* Generar columnas para cada día de la semana */}
                                {Array.from({ length: 7 }, (_, i) => i).map(i => {
                                    const date = addDays(weekStart, i);
                                    return (
                                        <div key={date} className="col">
                                            <div className="head-cell">
                                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i]}<br />{date.slice(5)}
                                            </div>
                                            {/* Generar celdas horarias */}
                                            {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00').map(h => {
                                                const c = scheduleCells.find(k => k.date === date && k.hour === h);
                                                const st = ((c?.status ?? '') as string).toUpperCase();
                                                const pickable = st === 'DISPONIBLE' || st === 'AVAILABLE';
                                                const isSelected = selectedCell?.date === date && selectedCell?.hour === h;
                                                const key = `${date}_${h}`;
                                                // determine status class
                                                let statusClass = 'disabled';
                                                if (st) {
                                                    statusClass = pickable ? 'available' : 'taken';
                                                }
                                                // determine aria-label
                                                let ariaLabel = `No disponible ${h} ${date}`;
                                                if (pickable) {
                                                    ariaLabel = `Disponible ${h} ${date}`;
                                                } else if (st) {
                                                    ariaLabel = `Ocupado ${h} ${date}`;
                                                }

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
                                                        //  no tooltip con estados internos
                                                        onClick={pickable ? () => {
                                                            setSelectedCell({ date, hour: h, status: 'DISPONIBLE', reservationId: null, studentId: null });
                                                        } : undefined}
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
