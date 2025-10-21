import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from "react-oidc-context";
import WeekCalendar from '../components/WeekCalendar';
import {
  getScheduleForTutor,
  addAvailability,
  type ScheduleCell
} from '../service/Api-scheduler';
import '../styles/Calendar.css';
// Obtener el lunes de la semana dada una fecha ISO
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0..6 (dom=0)
  const diff = (dow === 0 ? -6 : 1) - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}
// Sumar días a una fecha ISO
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10); // seguro en UTC
}
// Tipo de operación: agregar o eliminar
type OperationMode = 'add' | 'delete';
const toHHMM = (h: string) => {
  const s = (h ?? '').trim();
  const regex = /^(\d{1,2}):(\d{2})/;
  const m = regex.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
};
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
  // Cargar celdas para la semana actual
  const load = useCallback(async () => {
    if (!tutorId || !token) return;
    setLoading(true);
    try {
      console.log(`🔄 Cargando disponibilidad para semana ${weekStart}`);
      const data = await getScheduleForTutor(tutorId, weekStart, token);
      console.log(`📊 Recibidas ${data.length} celdas:`, data);
      (globalThis as any).__cells = data; //  para inspección en consola
      setCells(data);
    } catch (e: any) {
      console.error('❌ Error cargando disponibilidad:', e);
      setMessage('❌ ' + (e.message || 'Error cargando disponibilidad'));
    } finally {
      setLoading(false);
    }
  }, [tutorId, weekStart, token]);
  useEffect(() => {
    load();
  }, [load]);
  // Alternar selección de una celda
  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // Limpiar selección y mensajes
  const clear = () => {
    setSelected(new Set());
    setMessage(null);
  };
  // Agrupar selección por día
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    selected.forEach(k => {
      const [date, hour] = k.split('_');
      const arr = m.get(date) || [];
      arr.push(toHHMM(hour)); // usa el mismo normalizador
      m.set(date, arr);
    });
    m.forEach((arr) => {
      arr.sort((a, b) => a.localeCompare(b));
    });
    return m;
  }, [selected]);
  // Confirmar agregar disponibilidad
  const confirmAdd = async () => {
    if (byDay.size === 0) {
      setMessage('⚠️ Selecciona una o más horas para agregar.');
      return;
    }
    // Confirmación
    const totalHours = selected.size;
    const confirm = globalThis.confirm(
      `¿Agregar disponibilidad en ${byDay.size} día(s) con ${totalHours} hora(s) seleccionada(s)?`
    );
    if (!confirm) return;
    // Procesar adiciones
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    // Agrupar por día y agregar
    try {
      // Procesar todas las peticiones
      for (const [date, hours] of Array.from(byDay.entries())) {
        if (!token) throw new Error("No autenticado");
        // Llamar al endpoint de agregar disponibilidad
        try {
          console.log(`📤 Agregando disponibilidad para ${date}:`, hours);
          const r = await addAvailability(date, hours, token);
          successCount += r.addedCount;
          console.log(`✅ Agregadas ${r.addedCount} horas para ${date}`);
        } catch (e: any) {
          errorCount += hours.length;
          const errorMsg = `${date}: ${e.message}`;
          errors.push(errorMsg);
          console.error(`❌ Error en ${date}:`, e);
        }
      }

      // Mostrar mensaje de resultado
      if (errorCount === 0) {
        setMessage(`✅ ${successCount} hora(s) de disponibilidad agregadas correctamente.`);
      } else if (successCount > 0) {
        setMessage(`⚠️ ${successCount} hora(s) agregadas, pero ${errorCount} fallaron:\n${errors.join('\n')}`);
      } else {
        setMessage(`❌ Error agregando disponibilidad:\n${errors.join('\n')}`);
      }

      // Limpiar selección
      setSelected(new Set());

      // Esperar un poco antes de recargar para dar tiempo al backend
      console.log('⏳ Esperando 500ms antes de recargar...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Recargar los datos
      console.log('🔄 Recargando calendario...');
      await load();
      console.log('✅ Calendario recargado');

    } catch (e: any) {
      console.error('❌ Error general:', e);
      setMessage('❌ ' + (e.message || 'Error agregando disponibilidad'));
    } finally {
      setLoading(false);
    }
  };
  // Confirmar eliminar disponibilidad
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
    // Si no hay celdas válidas, avisar y salir
    if (cellsToDelete.length === 0) {
      setMessage('⚠️ No hay disponibilidad para eliminar en la selección.');
      return;
    }
    // Confirmación
    const confirm = globalThis.confirm(
      `¿Eliminar ${cellsToDelete.length} hora(s) de disponibilidad?\n\n` +
      `ADVERTENCIA: Las horas con reservas activas NO se eliminarán.`
    );
    if (!confirm) return;
    // Procesar eliminaciones
    setLoading(true);
    try {
      // Agrupar por día y eliminar
      const byDayDelete = new Map<string, string[]>();
      for (const c of cellsToDelete) {
        if (!c) continue;
        const arr = byDayDelete.get(c.date) || [];
        arr.push(c.hour);
        byDayDelete.set(c.date, arr);
      }
      // Procesar todas las peticiones de eliminación
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
        //  Verificar respuesta
        if (!res.ok) {
          const error = await res.text();
          throw new Error(error || 'Error eliminando disponibilidad');
        }
      }
      // Mostrar mensaje de éxito
      setMessage(`✅ ${cellsToDelete.length} hora(s) eliminada(s) correctamente.`);
      setSelected(new Set());

      // Esperar antes de recargar
      await new Promise(resolve => setTimeout(resolve, 500));
      await load();
      // Recargar datos
    } catch (e: any) {
      console.error(e);
      setMessage('❌ ' + (e.message || 'Error eliminando disponibilidad'));
    } finally {
      setLoading(false);
    }
  };
  // Navegar a la semana anterior
  const prev = () => {
    setWeekStart(addDays(weekStart, -7));
    setSelected(new Set()); // Limpiar selección al cambiar semana
  };
  // Navegar a la semana siguiente
  const next = () => {
    setWeekStart(addDays(weekStart, 7));
    setSelected(new Set()); // Limpiar selección al cambiar semana
  };

  return (
    <div className="page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '8px' }}>Mi disponibilidad</h1>
      <p className="instruction-text">
        {mode === 'add'
          ? 'Haz clic y arrastra para seleccionar horas vacías y agregarlas a tu disponibilidad.'
          : 'Haz clic y arrastra para seleccionar horas con disponibilidad existente y eliminarlas.'}
      </p>

      {message && (() => {
        let backgroundColor = '#FFF7ED';
        if (message.includes('✅')) backgroundColor = '#ECFDF5';
        else if (message.includes('❌')) backgroundColor = '#FEF2F2';

        let borderColor = '#FED7AA';
        if (message.includes('✅')) borderColor = '#A7F3D0';
        else if (message.includes('❌')) borderColor = '#FECACA';

        let textColor = '#92400E';
        if (message.includes('✅')) textColor = '#065F46';
        else if (message.includes('❌')) textColor = '#991B1B';

        return (
          <div style={{
            margin: '12px 0',
            padding: '12px 16px',
            background: backgroundColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            color: textColor,
            fontWeight: 500
          }}>
            {message}
          </div>
        );
      })()}

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

      {loading && <div style={{ textAlign: 'center', padding: '20px' }}>⏳ Cargando...</div>}

      <WeekCalendar
        weekStart={weekStart}
        cells={cells}
        mode="tutor"
        selectedKeys={selected}
        onToggle={toggle}
        onPrevWeek={prev}
        onNextWeek={next}
      />

      {/* Debug info */}
      <div style={{ marginTop: '20px', padding: '12px', background: '#F3F4F6', borderRadius: '8px', fontSize: '12px' }}>
        <strong>Debug:</strong> {cells.length} celdas cargadas para semana {weekStart}
      </div>
    </div>
  );
};

export default TutorAvailabilityPage;