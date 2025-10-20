import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { 
  acceptReservation, 
  cancelReservation, 
  getTutorReservations, 
  type Reservation 
} from '../service/Api-scheduler';
import '../styles/TutorDashboard.css';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5); // HH:mm
}

const TutorClassesPage: React.FC = () => {
  const auth = useAuth();
  const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ACTIVA' | 'ACEPTADO' | 'CANCELADO'>('all');

  const load = useCallback(async () => {
    if (!token) {
      setMessage('⚠️ No hay sesión activa');
      return;
    }
    
    setLoading(true);
    try {
      // Cargar reservas de los últimos 30 días y próximos 60 días
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      const to = new Date(today);
      to.setDate(to.getDate() + 60);
      
      const fromStr = from.toISOString().slice(0, 10);
      const toStr = to.toISOString().slice(0, 10);
      
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

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (reservationId: string) => {
    if (!token) return;
    const ok = globalThis.confirm('¿Aceptar esta clase?');
    if (!ok) return;

    try {
      await acceptReservation(reservationId, token);
      setMessage('✅ Clase aceptada correctamente');
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error aceptando clase'));
    }
  };

  const handleCancel = async (reservationId: string) => {
    if (!token) return;
    const ok = globalThis.confirm('¿Cancelar esta clase? Esta acción no se puede deshacer.');
    if (!ok) return;

    try {
      await cancelReservation(reservationId, token);
      setMessage('✅ Clase cancelada correctamente');
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error cancelando clase'));
    }
  };

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

  const filteredReservations = filterStatus === 'all' 
    ? reservations 
    : reservations.filter(r => r.status === filterStatus);

  // Agrupar por estudiante
  const groupedByStudent = filteredReservations.reduce((acc, res) => {
    const key = res.studentId;
    if (!acc[key]) {
      acc[key] = {
        studentId: res.studentId,
        studentName: res.studentName || 'Estudiante desconocido',
        reservations: []
      };
    }
    acc[key].reservations.push(res);
    return acc;
  }, {} as Record<string, { studentId: string; studentName: string; reservations: Reservation[] }>);

  const studentGroups = Object.values(groupedByStudent);

  // Calcular estadísticas
  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'ACTIVA').length,
    accepted: reservations.filter(r => r.status === 'ACEPTADO').length,
    cancelled: reservations.filter(r => r.status === 'CANCELADO').length
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
      
      {message && (
        <div style={{ 
          margin: '12px 0', 
          padding: '12px 16px', 
          background: message.includes('✅') ? '#ECFDF5' : message.includes('❌') ? '#FEF2F2' : '#FFF7ED',
          border: `1px solid ${message.includes('✅') ? '#A7F3D0' : message.includes('❌') ? '#FECACA' : '#FED7AA'}`,
          borderRadius: '8px',
          color: message.includes('✅') ? '#065F46' : message.includes('❌') ? '#991B1B' : '#92400E',
          fontWeight: 500
        }}>
          {message}
        </div>
      )}

      {/* Estadísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Clases</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>{stats.pending}</h3>
            <p>Pendientes</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.accepted}</h3>
            <p>Aceptadas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <h3>{stats.cancelled}</h3>
            <p>Canceladas</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px',
        padding: '12px',
        background: '#F9FAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB'
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
        <button
          className="btn-modern btn-secondary-modern"
          onClick={load}
          disabled={loading}
          style={{ marginLeft: 'auto', fontSize: '13px', padding: '6px 12px' }}
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Lista de clases agrupadas por estudiante */}
      {studentGroups.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          background: '#F9FAFB', 
          borderRadius: '12px',
          color: '#6B7280'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>📭</p>
          <p>No hay clases {filterStatus !== 'all' ? `con estado "${getStatusText(filterStatus)}"` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {studentGroups.map(group => {
            const sortedReservations = [...group.reservations].sort((a, b) => {
              const dateA = new Date(a.date + 'T' + a.start);
              const dateB = new Date(b.date + 'T' + b.start);
              return dateA.getTime() - dateB.getTime();
            });

            return (
              <div 
                key={group.studentId} 
                style={{ 
                  border: '1px solid #E5E7EB', 
                  borderRadius: '12px', 
                  padding: '16px',
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '2px solid #F3F4F6'
                }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    🎓
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                      {group.studentName}
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                      {group.reservations.length} clase{group.reservations.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Clases del estudiante */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sortedReservations.map(res => (
                    <div 
                      key={res.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: '16px',
                        alignItems: 'center',
                        padding: '12px',
                        background: '#F9FAFB',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB'
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                          📅 {formatDate(res.date)} • 🕐 {formatTime(res.start)} - {formatTime(res.end)}
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                          ID: {res.id.slice(0, 8)}...
                        </p>
                      </div>

                      <div>
                        <span 
                          className="status-badge"
                          style={{ 
                            color: getStatusColor(res.status),
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '4px 12px',
                            background: `${getStatusColor(res.status)}15`,
                            borderRadius: '999px'
                          }}
                        >
                          {getStatusText(res.status)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {res.status === 'ACTIVA' && (
                          <>
                            <button
                              className="btn-primary"
                              onClick={() => handleAccept(res.id)}
                              style={{ fontSize: '13px', padding: '6px 12px' }}
                            >
                              ✓ Aceptar
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleCancel(res.id)}
                              style={{ fontSize: '13px', padding: '6px 12px' }}
                            >
                              ✗ Cancelar
                            </button>
                          </>
                        )}
                        {res.status === 'ACEPTADO' && (
                          <button
                            className="btn btn-danger"
                            onClick={() => handleCancel(res.id)}
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            Cancelar
                          </button>
                        )}
                        {res.status === 'CANCELADO' && (
                          <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
                            Clase cancelada
                          </span>
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