import React, { useMemo, useRef } from 'react';
import '../styles/Calendar.css';
import type { ScheduleCell, CellStatus } from '../service/Api-scheduler';

export type Mode = 'student' | 'tutor';
/** Props para WeekCalendar */
export interface WeekCalendarProps {
  weekStart: string;
  cells: ScheduleCell[];
  mode: Mode;
  selectedKeys?: Set<string>;
  onToggle?: (key: string, cell: ScheduleCell) => void;
  onSinglePick?: (cell: ScheduleCell) => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onClear?: () => void;
}
/** Convierte hora a HH:mm */
function toHHMM(h: string) {
  const s = (h ?? '').trim();
  const regex = /^(\d{1,2}):(\d{2})/;
  const m = regex.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
}
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10); 
}
/** Genera lista de horas (00:00 a 23:00) */
function hours(): string[] {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) {
    arr.push(String(h).padStart(2, '0') + ':00');
  }
  return arr;
}
function classForStatus(status: CellStatus | undefined | null): string {
  switch (status) {
    case 'DISPONIBLE': return 'cell available';
    case 'PENDIENTE':  return 'cell pending';
    case 'ACTIVA':     return 'cell pending';   // legacy a misma clase que PENDIENTE
    case 'ACEPTADO':   return 'cell accepted';
    case 'CANCELADO':  return 'cell canceled';
    case 'VENCIDA':    return 'cell expired';   // slots pasados (rosa)
    case 'INCUMPLIDA': return 'cell failed';    // slots incumplidos (rojo)
    default:           return 'cell disabled';
  }
}

/** Etiquetas legibles. */
function getStatusLabel(status: CellStatus | undefined | null): string {
  switch (status) {
    case 'DISPONIBLE': return 'Disponible';
    case 'PENDIENTE':
    case 'ACTIVA':     return 'Pendiente'; // legacy
    case 'ACEPTADO':   return 'Aceptada';
    case 'CANCELADO':  return 'Cancelada';
    case 'VENCIDA':    return 'Vencida';
    case 'INCUMPLIDA': return 'Incumplida';
    default:           return '';
  }
}
/** Lista de horas (00:00 a 23:00) */
const H_LIST = hours();
/** Componente de calendario semanal */
const WeekCalendar: React.FC<WeekCalendarProps> = ({
  weekStart, cells, mode, selectedKeys, onToggle, onSinglePick, onPrevWeek, onNextWeek, onClear
}) => {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);
  // Mapa de celdas
  const map = useMemo(() => {
    const priority: Record<Exclude<CellStatus, null>, number> = {
      ACEPTADO: 4,
      PENDIENTE: 3,
      ACTIVA: 3,      // legacy
      DISPONIBLE: 2,
      CANCELADO: 1,
      VENCIDA: 0,
      INCUMPLIDA: 0
    };
    const pr = (s: CellStatus | null | undefined) => (s ? priority[s] ?? 0 : 0);
    // unificamos por (date,hour) quedándonos con el de mayor prioridad
    const m = new Map<string, ScheduleCell>();
    for (const c of cells || []) {
      const hhmm = toHHMM(c.hour);
      const key = `${c.date}_${hhmm}`;
      const next = { ...c, hour: hhmm };
      const prev = m.get(key);
      const pPrev = pr(prev?.status);
      const pNext = pr(next.status);
      if (!prev || pNext >= pPrev) m.set(key, next);
    }
    return m;
  }, [cells]);

  const mouseDown = useRef(false);
  const paintMode = useRef<'select' | 'deselect' | null>(null);
  const processedInDrag = useRef<Set<string>>(new Set());
  // Handlers de interacción
  const handleDown = (key: string, cell: ScheduleCell) => {
    if (mode !== 'tutor' || !onToggle) return;
    mouseDown.current = true;
    processedInDrag.current = new Set();
    // Añadimos la celda actual al conjunto de celdas procesadas
    const isCurrentlySelected = selectedKeys?.has(key) || false;
    paintMode.current = isCurrentlySelected ? 'deselect' : 'select';
    // Procesamos la celda actual
    processedInDrag.current.add(key);
    onToggle(key, cell);
  };
  // Handler para entrar en celda durante arrastre
  const handleEnter = (key: string, cell: ScheduleCell) => {
    if (!mouseDown.current || mode !== 'tutor' || !onToggle) return;
    if (processedInDrag.current.has(key)) return;
    // Marcamos como procesada
    processedInDrag.current.add(key);
    const isCurrentlySelected = selectedKeys?.has(key) || false;
    if ((paintMode.current === 'select' && !isCurrentlySelected) ||
        (paintMode.current === 'deselect' && isCurrentlySelected)) {
      onToggle(key, cell);
    }
  };
  // Handler para soltar el ratón
  const handleUp = () => {
    mouseDown.current = false;
    paintMode.current = null;
    processedInDrag.current.clear();
  };

  const handleClick = (_key: string, cell: ScheduleCell) => {
    // Solo para modo estudiante: solo se puede elegir DISPONIBLE
    if (mode === 'student') {
      const canPick = cell.status === 'DISPONIBLE';
      if (canPick && onSinglePick) onSinglePick(cell);
    }
  };
  // Renderizado de celda
  const renderCell = (d: string, h: string) => {
    const key = `${d}_${h}`;
    const cell = map.get(key) || { date: d, hour: h, status: null, reservationId: null, studentId: null };
    const isSelected = !!selectedKeys?.has(key);
    const canPick = mode === 'student' ? cell.status === 'DISPONIBLE' : true;
    /** Clase CSS según estado de celda. */
    const css = [
      classForStatus(cell.status),
      isSelected ? 'selected' : '',
      canPick ? 'can-pick' : 'not-pickable'
    ].join(' ').trim();
    // Etiqueta legible
    const label = getStatusLabel(cell.status);

    return (
      <button
        key={key}
        type="button"
        className={css}
        onMouseDown={(e) => { e.preventDefault(); handleDown(key, cell); }}
        onMouseEnter={() => handleEnter(key, cell)}
        onMouseUp={handleUp}
        onClick={() => handleClick(key, cell)}
        title={`${d} ${h} ${cell.status || ''}`}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {label && <span>{label}</span>}
        {label && <span className="dot" />}
      </button>
    );
  };

  React.useEffect(() => {
    const globalHandleUp = () => { if (mouseDown.current) handleUp(); };
    globalThis.addEventListener('mouseup', globalHandleUp);
    globalThis.addEventListener('touchend', globalHandleUp);
    return () => {
      globalThis.removeEventListener('mouseup', globalHandleUp);
      globalThis.removeEventListener('touchend', globalHandleUp);
    };
  }, []);

  return (
    <fieldset className="calendar-wrapper" aria-label="Week calendar">
      <div className="calendar-controls" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => onPrevWeek?.()} className="ctrl-btn">Prev</button>
        <button type="button" onClick={() => onNextWeek?.()} className="ctrl-btn">Next</button>
        <button type="button" onClick={() => onClear?.()} className="ctrl-btn">Clear</button>
      </div>
      <div className="calendar-grid">
        <div className="col hour-col">
          <div className="head-cell">Hora</div>
          {H_LIST.map(h => <div key={h} className="hour-cell">{h}</div>)}
        </div>

        {days.map((d, idx) => (
          <div key={d} className="col">
            <div className="head-cell">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][idx]}<br />{d}</div>
            {H_LIST.map(h => renderCell(d, h))}
          </div>
        ))}
      </div>
    </fieldset>
  );
};

export default WeekCalendar;
