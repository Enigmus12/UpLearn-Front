import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from "react-oidc-context";
import WeekCalendar from '../components/WeekCalendar';
import { 
  getScheduleForTutor, 
  addAvailability, 
  deleteAvailabilitySlots,
  type ScheduleCell 
} from '../service/Api-scheduler';
import '../styles/Calendar.css';

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type OperationMode = 'add' | 'delete';

const TutorAvailabilityPage: React.FC = () => {
  const auth = useAuth();
  const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
  const tutorId = auth.user?.profile?.sub || '';
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date().toISOString().slice(0, 10)));
  const [cells, setCells] = useState<ScheduleCell[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<OperationMode>('add');

  const load = useCallback(async () => {
    if (!tutorId || !token) return;
    setLoading(true);
    try {
      const data = await getScheduleForTutor(tutorId, weekStart, token).catch((e) => {
        console.error('Error cargando disponibilidad:', e);
        return [];
      });
      setCells(data);
    } catch (e: any) {
      console.error(e);
      setMessage('❌ ' + (e.message || 'Error cargando disponibilidad'));
    } finally {
      setLoading(false);
    }
  }, [tutorId, weekStart, token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); 
      else next.add(key);
      return next;
    });
  };

  const clear = () => {
    setSelected(new Set());
    setMessage(null);
  };

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    selected.forEach(k => {
      const [date, hour] = k.split('_');
      const arr = m.get(date) || [];
      arr.push(hour);
      m.set(date, arr);
    });
    m.forEach((arr, d) => {
      arr.sort();
      m.set(d, arr);
    });
    return m;
  }, [selected]);

  const confirmAdd = async () => {
    if (byDay.size === 0) { 
      setMessage('⚠️ Selecciona una o más horas para agregar.'); 
      return; 
    }
    
    const confirm = window.confirm(
      `¿Agregar disponibilidad en ${byDay.size} día(s) con ${selected.size} hora(s) seleccionada(s)?`
    );
    if (!confirm) return;

    setLoading(true);
    try {
      for (const [date, hours] of Array.from(byDay.entries())) {
        if (!token) throw new Error("No autenticado");
        await addAvailability(date, hours, token);
      }
      setMessage('✅ Disponibilidad agregada correctamente.');
      setSelected(new Set());
      await load();
    } catch (e: any) {
      console.error(e);
      setMessage('❌ ' + (e.message || 'Error agregando disponibilidad'));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (selected.size === 0) { 
      setMessage('⚠️ Selecciona una o más horas existentes para eliminar.'); 
      return; 
    }

    // Filtrar solo celdas que tienen disponibilidad
    const cellsToDelete = Array.from(selected)
      .map(key => {
        const [date, hour] = key.split('_');
        return cells.find(c => c.date === date && c.hour === hour);
      })
      .filter(c => c && c.status === 'DISPONIBLE');

    if (cellsToDelete.length === 0) {
      setMessage('⚠️ No hay disponibilidad para eliminar en la selección.');
      return;
    }

    const confirm = window.confirm(
      `¿Eliminar ${cellsToDelete.length} hora(s) de disponibilidad?\n\n` +
      `ADVERTENCIA: Las horas con reservas activas NO se eliminarán.`
    );
    if (!confirm) return;

    setLoading(true);
    try {
      // Agrupar por día y eliminar
      const byDayDelete = new Map<string, string[]>();
      cellsToDelete.forEach(c => {
        if (!c) return;
        const arr = byDayDelete.get(c.date) || [];
        arr.push(c.hour);
        byDayDelete.set(c.date, arr);
      });

      for (const [date, hours] of Array.from(byDayDelete.entries())) {
        if (!token) throw new Error("No autenticado");
        // Obtener las horas existentes del día
        const existingHours = cells
          .filter(c => c.date === date && c.status === 'DISPONIBLE')
          .map(c => c.hour);
        
        // Nuevas horas = existentes - las que queremos eliminar
        const newHours = existingHours.filter(h => !hours.includes(h));
        
        // Usar el endpoint PUT existente con las horas restantes
        const url = `http://localhost:8090/api/availability/day/${date}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ hours: newHours })
        });
        
        if (!res.ok) {
          const error = await res.text();
          throw new Error(error || 'Error eliminando disponibilidad');
        }
      }

      setMessage(`✅ ${cellsToDelete.length} hora(s) eliminada(s) correctamente.`);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      console.error(e);
      setMessage('❌ ' + (e.message || 'Error eliminando disponibilidad'));
    } finally {
      setLoading(false);
    }
  };

  const prev = () => setWeekStart(addDays(weekStart, -7));
  const next = () => setWeekStart(addDays(weekStart, 7));

  return (
    <div className="page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '8px' }}>Mi disponibilidad</h1>
      <p className="instruction-text">
        {mode === 'add' 
          ? 'Haz clic y arrastra para seleccionar horas vacías y agregarlas a tu disponibilidad.' 
          : 'Haz clic y arrastra para seleccionar horas con disponibilidad existente y eliminarlas.'}
      </p>
      
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

      {/* Selector de modo */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '12px',
        padding: '8px',
        background: '#F9FAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB'
      }}>
        <span style={{ fontWeight: 600, marginRight: '8px', alignSelf: 'center' }}>Modo:</span>
        <button
          className={`btn-modern ${mode === 'add' ? 'btn-primary-modern' : 'btn-secondary-modern'}`}
          onClick={() => { setMode('add'); clear(); }}
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          ➕ Agregar disponibilidad
        </button>
        <button
          className={`btn-modern ${mode === 'delete' ? 'btn-primary-modern' : 'btn-secondary-modern'}`}
          onClick={() => { setMode('delete'); clear(); }}
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          🗑️ Eliminar disponibilidad
        </button>
      </div>

      <div className="action-buttons">
        <button 
          className="btn-modern btn-secondary-modern" 
          onClick={clear} 
          disabled={selected.size === 0}
        >
          Limpiar selección
        </button>
        
        {mode === 'add' ? (
          <button 
            className="btn-modern btn-primary-modern" 
            onClick={confirmAdd} 
            disabled={loading || selected.size === 0}
          >
            {loading ? 'Agregando...' : '✓ Confirmar agregar disponibilidad'}
          </button>
        ) : (
          <button 
            className="btn-modern"
            onClick={confirmDelete} 
            disabled={loading || selected.size === 0}
            style={{
              background: '#EF4444',
              color: 'white',
              border: 'none'
            }}
          >
            {loading ? 'Eliminando...' : '🗑️ Confirmar eliminar disponibilidad'}
          </button>
        )}
      </div>

      {/* Navegación de semana */}
      <div className="week-nav" style={{ marginBottom: '16px' }}>
        <button className="btn-ghost" onClick={prev}>
          ◀ Semana anterior
        </button>
        <div className="week-nav__title">
          Semana {weekStart} — {addDays(weekStart, 6)}
        </div>
        <button className="btn-ghost" onClick={next}>
          Siguiente semana ▶
        </button>
      </div>

      <WeekCalendar
        weekStart={weekStart}
        cells={cells}
        mode="tutor"
        selectedKeys={selected}
        onToggle={toggle}
        onPrevWeek={prev}
        onNextWeek={next}
      />
    </div>
  );
};

export default TutorAvailabilityPage;