import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import { fetchWeekAvailability, createReservation } from '../service/Api-reservations';
import '../styles/ReservationPage.css';

dayjs.extend(localizedFormat);
dayjs.extend(isoWeek);

type Slot = { start: string; end: string; available: boolean };
type GridDay = { day: string; slots: Slot[] };

// Parámetros de grilla por defecto
const SLOT_MINUTES = 60;
const DAY_START = '08:00';
const DAY_END = '20:00';

const ReservationPage: React.FC = () => {
  // Forzamos tutorId a string, con fallback a ''
  const { tutorId: tutorIdParam } = useParams<{ tutorId: string }>();
  const tutorId = tutorIdParam && tutorIdParam !== 'undefined' ? tutorIdParam : '';

  const navigate = useNavigate();
  const auth = useAuth();

  const token = useMemo(
    () => ((auth.user as any)?.access_token as string) || '',
    [auth.user]
  );

  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));
  const [grid, setGrid] = useState<GridDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    // Ya no usamos studentId; se deriva del token en el backend
    if (!tutorId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeekAvailability(
        token,
        tutorId,
        weekStart.format('YYYY-MM-DD'),
        SLOT_MINUTES,
        DAY_START,
        DAY_END
      );
      setGrid(Array.isArray(data.days) ? data.days : []);
    } catch (e: any) {
      setError(e?.message || 'No fue posible cargar disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Dependencias: tutorId, token y la fecha de inicio (como string estable)
  }, [tutorId, token, weekStart.valueOf()]); // valueOf() evita recreaciones por objetos Dayjs

  const nextWeek = () => {
    const next = weekStart.add(1, 'week');
    if (next.isAfter(dayjs().add(3, 'month'))) return;
    setWeekStart(next);
  };
  const prevWeek = () => setWeekStart(weekStart.subtract(1, 'week'));
  const nextMonth = () => {
    const next = weekStart.add(1, 'month');
    if (next.isAfter(dayjs().add(3, 'month'))) return;
    setWeekStart(next);
  };
  const prevMonth = () => setWeekStart(weekStart.subtract(1, 'month'));
  const goToday = () => setWeekStart(dayjs().startOf('week').add(1, 'day'));

  const handleReserve = async (day: string, start: string, end: string) => {
    if (!tutorId) {
      alert('No se encontró el tutorId en la URL.');
      return;
    }
    try {
      await createReservation(token, { tutorId, day, start, end });
      alert('Reserva creada');
      load();
    } catch (e: any) {
      alert(e?.message || 'No fue posible crear la reserva');
    }
  };

  const hasGrid = grid.length > 0 && grid[0]?.slots?.length > 0;

  return (
    <div className="res-page">
      <header className="res-header">
        <h2 className="res-title">
          Reservar sesión con tutor <span className="res-title-id">#{tutorId || '—'}</span>
        </h2>

        <div className="res-toolbar">
          <button className="btn btn-secondary" onClick={prevWeek} disabled={!tutorId}>
            Semana anterior
          </button>
          <div className="res-range">
            {weekStart.format('LL')} – {weekStart.add(6, 'day').format('LL')}
          </div>
          <button className="btn btn-secondary" onClick={nextWeek} disabled={!tutorId}>
            Semana siguiente
          </button>
          <div className="res-toolbar-split" />
          <button className="btn btn-secondary" onClick={prevMonth} disabled={!tutorId}>
            Mes anterior
          </button>
          <button className="btn btn-secondary" onClick={nextMonth} disabled={!tutorId}>
            Mes siguiente
          </button>
          <button className="btn btn-primary" onClick={goToday}>
            Hoy
          </button>
        </div>

        {error && <div className="res-error"> {error} </div>}
        {!tutorId && (
          <div className="res-error">No hay tutorId en la URL. Vuelve e intenta de nuevo.</div>
        )}
      </header>

      <main className="res-main">
        {loading ? (
          <div className="res-loading">Cargando disponibilidad…</div>
        ) : !hasGrid ? (
          <div className="res-empty">No hay datos de disponibilidad para esta semana.</div>
        ) : (
          <div className="res-grid-wrap">
            <table className="res-grid">
              <thead>
                <tr>
                  <th className="res-grid-hour">Hora</th>
                  {grid.map((d) => (
                    <th key={d.day} className="res-grid-day">
                      {dayjs(d.day).format('ddd DD')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid[0].slots.map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="res-grid-hourcell">
                      {grid[0].slots[rowIdx].start.slice(0, 5)}–{grid[0].slots[rowIdx].end.slice(0, 5)}
                    </td>
                    {grid.map((d) => {
                      const slot = d.slots[rowIdx];
                      const disabled = !slot.available;
                      return (
                        <td key={d.day + rowIdx} className="res-grid-slotcell">
                          <button
                            className={`res-slot-btn ${disabled ? 'res-slot-btn--busy' : 'res-slot-btn--free'}`}
                            disabled={disabled || !tutorId}
                            onClick={() => handleReserve(d.day, slot.start, slot.end)}
                          >
                            {disabled ? 'Ocupado' : 'Reservar'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="res-footer">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Volver</button>
      </footer>
    </div>
  );
};

export default ReservationPage;
