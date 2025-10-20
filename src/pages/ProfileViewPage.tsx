import React, { useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import '../styles/EditProfilePage.css';

type RoleView = 'student' | 'tutor';

interface ProfileState {
    // viene desde la navegación
    profile?: {
        userId?: string;
        name?: string;
        email?: string;
        phoneNumber?: string;
        idType?: string;
        idNumber?: string;
        // student
        educationLevel?: string;
        // tutor
        bio?: string;
        specializations?: string[];
        credentials?: string[];
    };
}
// Página para ver el perfil de otro usuario (tutor o estudiante)
const ProfileViewPage: React.FC = () => {
    const { role } = useParams<{ role: RoleView }>();
    const location = useLocation();
    const navigate = useNavigate();

    const auth = useAuth();

    // Preferimos datos enviados por navegación (desde tarjetas/buscador)
    const state = location.state as ProfileState | undefined;
    const profile = useMemo(() => state?.profile ?? {}, [state]);
    // Si no hay datos en el estado, podríamos cargar desde API (no implementado aquí)
    const effectiveRole: RoleView = (role === 'tutor' || role === 'student') ? role : 'tutor';
    // Datos básicos
    const fullName = profile.name ?? auth.user?.profile?.name ?? 'Usuario';


    return (
        <div className="edit-profile-container">
            <div className="edit-profile-content">
                <div className="profile-header">
                    <h1>Perfil</h1>
                    <p>Información del usuario</p>
                    <div className="user-role-badge">
                        {effectiveRole === 'student' ? '🎓 Estudiante' : '👨‍🏫 Tutor'}
                    </div>
                </div>

                {/* Reutiliza los estilos de EditProfilePage pero en solo-lectura */}
                <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
                    <div className="form-section">
                        <h2>Información Personal</h2>

                        <div className="form-group">
                            <label className="form-label" htmlFor="fullName">Nombre Completo</label>
                            <input id="fullName" name="fullName" className="form-input" value={fullName} disabled readOnly />
                        </div>

                    </div>

                    {effectiveRole === 'student' && (
                        <div className="form-section">
                            <h2>Información Académica</h2>
                            <div className="form-group">
                                <label className="form-label" htmlFor="educationLevel">Nivel Educativo</label>
                                <input id="educationLevel" name="educationLevel" className="form-input" value={profile.educationLevel ?? '—'} disabled readOnly />
                            </div>
                        </div>
                    )}

                    {effectiveRole === 'tutor' && (
                        <div className="form-section">
                            <h2>Información Profesional</h2>

                            {profile.bio && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="bio">Biografía</label>
                                    <textarea id="bio" className="form-input form-textarea" value={profile.bio} disabled readOnly rows={4} />
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="specializations" className="form-label">Especializaciones</label>
                                <div className="tags-container">
                                    {profile.specializations?.length
                                        ? (
                                            <>
                                                {profile.specializations.map((s) => <span key={s} className="tag">{s}</span>)}
                                                <input
                                                    id="specializations"
                                                    className="form-input"
                                                    value={profile.specializations.join(', ')}
                                                    readOnly
                                                    aria-hidden="true"
                                                    tabIndex={-1}
                                                    style={{ position: 'absolute', left: '-10000px' }}
                                                />
                                            </>
                                        )
                                        : <input id="specializations" className="form-input" value="—" disabled readOnly />
                                    }
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="credentials" className="form-label">Credenciales</label>
                                <div className="tags-container">
                                    {profile.credentials?.length
                                        ? (
                                            <>
                                                {profile.credentials.map((c) => <span key={c} className="tag">{c}</span>)}
                                                <input
                                                    id="credentials"
                                                    className="form-input"
                                                    value={profile.credentials.join(', ')}
                                                    readOnly
                                                    aria-hidden="true"
                                                    tabIndex={-1}
                                                    style={{ position: 'absolute', left: '-10000px' }}
                                                />
                                            </>
                                        )
                                        : <input id="credentials" className="form-input" value="—" disabled readOnly />
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                        <div className="main-actions">
                            <button type="button" className="btn btn-primary" >
                                Contactar
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
                                Volver
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileViewPage;
