// src/pages/TutorAvailabilityPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import WeekCalendar from '../components/WeekCalendar';

import {
  getScheduleForTutor,
  addAvailability,
  clearDayAvailability,
  type ScheduleCell,
} from '../service/Api-scheduler';
import '../styles/Calendar.css';

// === Utilidades de fecha/hora ===
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0..6 (dom=0)
  const diff = (dow === 0 ? -6 : 1) - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
const toHHMM = (h: string) => {
  const s = (h ?? '').trim();
  const regex = /^(\d{1,2}):(\d{2})/;
  const m = regex.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
};

// a partir de la siguiente hora 
function nextSelectableHour(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  // redondear hacia arriba a la siguiente hora entera
  const cutoff = new Date(now);
  cutoff.setMinutes(0, 0, 0);
  cutoff.setHours(cutoff.getHours() + (now.getMinutes() > 0 ? 1 : 0));
  return cutoff;
}
function cellDateTimeLocal(dateISO: string, hhmm: string): Date {
  const [H, M] = hhmm.split(':').map(Number);
  const dt = new Date(dateISO + 'T00:00:00'); // local
  dt.setHours(H, M, 0, 0);
  return dt;
}
function isSelectable(dateISO: string, hhmm: string): boolean {
  const cutoff = nextSelectableHour();
  const dt = cellDateTimeLocal(dateISO, toHHMM(hhmm));
  return dt.getTime() >= cutoff.getTime();
}

// === Tipos ===
type OperationMode = 'add' | 'delete';
// === Componente principal ===
const TutorAvailabilityPage: React.FC = () => {
  const auth = useAuth();
  const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
  const tutorId = auth.user?.profile?.sub || '';
  // estados
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(new Date().toISOString().slice(0, 10))
  );
  const [cells, setCells] = useState<ScheduleCell[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<OperationMode>('add');

  // Recarga
  const load = useCallback(async () => {
    if (!tutorId || !token) return;
    setLoading(true);
    try {
      const data = await getScheduleForTutor(tutorId, weekStart, token);
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

  // mapa para consultar estado por clave
  const cellByKey = useMemo(() => {
    const m = new Map<string, ScheduleCell>();
    for (const c of cells) {
      const k = `${c.date}_${toHHMM(c.hour)}`;
      m.set(k, c);
    }
    return m;
  }, [cells]);

  // === ignora pasado y estados no válidos ===
  const toggle = (key: string) => {
    const [date, hhmm] = key.split('_');
    if (!isSelectable(date, hhmm)) {
      setMessage(
        `⚠️ No puedes seleccionar horas en el pasado. Solo a partir de ${nextSelectableHour().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}.`
      );
      return;
    }

    const c = cellByKey.get(key);
    // En modo "add" no se permite seleccionar horas ocupadas (PENDIENTE/ACEPTADO)
    if (mode === 'add' && (c?.status === 'PENDIENTE' || c?.status === 'ACEPTADO')) {
      setMessage('⚠️ Esa hora ya está reservada.');
      return;
    }

    // En modo "delete" solo se permiten celdas DISPONIBLES futuras
    if (mode === 'delete' && c?.status !== 'DISPONIBLE') {
      setMessage('⚠️ Solo puedes eliminar disponibilidad existente (DISPONIBLE) en futuro.');
      return;
    }
    // toggle
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // limpia selección y mensaje
  const clear = () => {
    setSelected(new Set());
    setMessage(null);
  };

  // Agrupar por día (solo futuras válidas)
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    selected.forEach(k => {
      const [date, hour] = k.split('_');
      if (isSelectable(date, hour)) {
        const arr = m.get(date) || [];
        arr.push(toHHMM(hour));
        m.set(date, arr);
      }
    });
    m.forEach(arr => arr.sort((a, b) => a.localeCompare(b)));
    return m;
  }, [selected]);

  // === Confirmar AGREGAR ===
  const confirmAdd = async () => {
    if (byDay.size === 0) {
      setMessage('⚠️ Selecciona una o más horas FUTURAS para agregar.');
      return;
    }

    // filtra por si el usuario llegó a incluir horas ya reservadas o pasadas
    const validPairs: Array<[string, string[]]> = [];
    for (const [date, hours] of Array.from(byDay.entries())) {
      const ok = hours.filter((h: string) => {
        const key = `${date}_${h}`;
        const c = cellByKey.get(key);
        return isSelectable(date, h) && !(c?.status === 'PENDIENTE' || c?.status === 'ACEPTADO');
      });
      if (ok.length) validPairs.push([date, ok]);
    }
    // filtra por si el usuario llegó a incluir horas ya reservadas o pasadas
    if (validPairs.length === 0) {
      setMessage('⚠️ La selección no contiene horas válidas para agregar.');
      return;
    }
    // resumen
    const totalHours = validPairs.reduce((acc, [, hs]) => acc + hs.length, 0);
    const ok = globalThis.confirm(
      `¿Agregar disponibilidad en ${validPairs.length} día(s) con ${totalHours} hora(s) seleccionada(s)?`
    );
    if (!ok) return;
    // ejecutar
    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      // procesar por día
      for (const [date, hours] of validPairs) {
        try {
          const r = await addAvailability(date, hours, token);
          successCount += r.addedCount;
        } catch (e: any) {
          errorCount += hours.length;
          errors.push(`${date}: ${e.message || 'Error'}`);
        }
      }
      // resumen
      if (errorCount === 0) setMessage(`✅ ${successCount} hora(s) de disponibilidad agregadas correctamente.`);
      else if (successCount > 0)
        setMessage(`⚠️ ${successCount} agregadas, ${errorCount} fallaron.\n${errors.join('\n')}`);
      else setMessage(`❌ No se pudo agregar disponibilidad.\n${errors.join('\n')}`);
      // recarga
      setSelected(new Set());
      await new Promise(r => setTimeout(r, 500));
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e.message || 'Error agregando disponibilidad'));
    } finally {
      setLoading(false);
    }
  };

  // === Confirmar ELIMINAR ===
  const confirmDelete = async () => {
    if (selected.size === 0) {
      setMessage('⚠️ Selecciona una o más horas DISPONIBLES futuras para eliminar.');
      return;
    }

    // solo DISPONIBLE y en el futuro
    const cellsToDelete = Array.from(selected)
      .map(key => {
        const [date, hour] = key.split('_');
        if (!isSelectable(date, hour)) return null;
        const c = cells.find(c => c.date === date && toHHMM(c.hour) === toHHMM(hour));
        return c && c.status === 'DISPONIBLE' ? c : null;
      })
      .filter(Boolean) as ScheduleCell[];

    if (cellsToDelete.length === 0) {
      setMessage('⚠️ No hay disponibilidad FUTURA para eliminar en la selección.');
      return;
    }
    // resumen
    const ok = globalThis.confirm(`¿Eliminar ${cellsToDelete.length} hora(s) de disponibilidad?`);
    if (!ok) return;
    // agrupar por día y ejecutar
    setLoading(true);
    try {
      const byDayDelete = new Map<string, string[]>();
      for (const c of cellsToDelete) {
        const arr = byDayDelete.get(c.date) || [];
        arr.push(toHHMM(c.hour));
        byDayDelete.set(c.date, arr);
      }
      // procesar por día
      for (const [date, toRemove] of Array.from(byDayDelete.entries())) {
        const existing = cells
          .filter(c => c.date === date && c.status === 'DISPONIBLE')
          .map(c => toHHMM(c.hour));
        // horas restantes
        const remaining = existing.filter(h => !toRemove.includes(h));

        if (remaining.length > 0) {
          const res = await fetch(`http://localhost:8090/api/availability/day/${date}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ hours: remaining }),
          });
          if (!res.ok) throw new Error(await res.text());
        } else {
          // ✅ día sin horas restantes → DELETE del día
          await clearDayAvailability(date, token);
        }
      }
      // resumen
      setMessage(`✅ ${cellsToDelete.length} hora(s) eliminada(s) correctamente.`);
      setSelected(new Set());
      await new Promise(r => setTimeout(r, 500));
      await load();
    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Error eliminando disponibilidad'));
    } finally {
      setLoading(false);
    }
  };
  // Navegación semana
  const prev = () => {
    setWeekStart(addDays(weekStart, -7));
    setSelected(new Set());
  };
  const next = () => {
    setWeekStart(addDays(weekStart, 7));
    setSelected(new Set());
  };

  // Texto dinámico con la hora mínima permitida
  const minHourText = useMemo(
    () => nextSelectableHour().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [weekStart] // cambia al navegar semanas; “ahora” se reevalúa en acciones
  );

  return (
    <div className="page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '8px' }}>Mi disponibilidad</h1>

      <p className="instruction-text">
        {mode === 'add'
          ? `Haz clic y arrastra para seleccionar horas vacías y agregarlas a tu disponibilidad.`
          : `Haz clic y arrastra para seleccionar horas con disponibilidad existente y eliminarlas.`}
        <br />
        <strong>Regla:</strong> Solo puedes seleccionar horas <u>a partir de {minHourText}</u>.
      </p>

      {message &&
        (() => {
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
            <div
              style={{
                margin: '12px 0',
                padding: '12px 16px',
                background: backgroundColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                color: textColor,
                fontWeight: 500,
              }}
            >
              {message}
            </div>
          );
        })()}

      {/* Selector de modo */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          padding: '8px',
          background: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
        }}
      >
        <span style={{ fontWeight: 600, marginRight: '8px', alignSelf: 'center' }}>Modo:</span>
        <button
          className={`btn-modern ${mode === 'add' ? 'btn-primary-modern' : 'btn-secondary-modern'}`}
          onClick={() => {
            setMode('add');
            clear();
          }}
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          ➕ Agregar disponibilidad
        </button>
        <button
          className={`btn-modern ${mode === 'delete' ? 'btn-primary-modern' : 'btn-secondary-modern'}`}
          onClick={() => {
            setMode('delete');
            clear();
          }}
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          🗑️ Eliminar disponibilidad
        </button>
      </div>

      <div className="action-buttons">
        <button className="btn-modern btn-secondary-modern" onClick={clear} disabled={selected.size === 0}>
          Limpiar selección
        </button>

        {mode === 'add' ? (
          <button className="btn-modern btn-primary-modern" onClick={confirmAdd} disabled={loading || selected.size === 0}>
            {loading ? 'Agregando...' : '✓ Confirmar agregar disponibilidad'}
          </button>
        ) : (
          <button
            className="btn-modern"
            onClick={confirmDelete}
            disabled={loading || selected.size === 0}
            style={{ background: '#EF4444', color: 'white', border: 'none' }}
          >
            {loading ? 'Eliminando...' : '🗑️ Confirmar eliminar disponibilidad'}
          </button>
        )}
      </div>

      {/* Navegación semana */}
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

      {/* onToggle bloquea pasado y estados */}
      <WeekCalendar
        weekStart={weekStart}
        cells={cells}
        mode="tutor"
        selectedKeys={selected}
        onToggle={toggle}
        onPrevWeek={prev}
        onNextWeek={next}
      />

      <div
        style={{
          marginTop: '20px',
          padding: '12px',
          background: '#F3F4F6',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      >
        <strong>Debug:</strong> {cells.length} celdas cargadas para semana {weekStart}
      </div>
    </div>
  );
};

export default TutorAvailabilityPage;
