import React, { useMemo, useRef} from 'react';
import '../styles/Calendar.css';
import type { ScheduleCell, CellStatus } from '../service/Api-scheduler';

export type Mode = 'student' | 'tutor';

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

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

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
    case 'ACTIVA':     return 'cell active';
    case 'ACEPTADO':   return 'cell accepted';
    case 'CANCELADO':  return 'cell canceled';
    default: return 'cell disabled';
  }
}

function getStatusLabel(status: CellStatus | undefined | null): string {
  switch (status) {
    case 'DISPONIBLE': return 'Disponible';
    case 'ACTIVA':     return 'Activa';
    case 'ACEPTADO':   return 'Aceptada';
    case 'CANCELADO':  return 'Cancelada';
    default: return '';
  }
}

const H_LIST = hours();

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  weekStart, cells, mode, selectedKeys, onToggle, onSinglePick, onPrevWeek, onNextWeek, onClear
}) => {
  const days = useMemo(() => {
    return Array.from({length: 7}, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const map = useMemo(() => {
    const m = new Map<string, ScheduleCell>();
    for (const c of cells || []) {
      m.set(`${c.date}_${c.hour}`, c);
    }
    return m;
  }, [cells]);

  const mouseDown = useRef(false);
  const paintMode = useRef<'select' | 'deselect' | null>(null); // Modo de pintura: agregar o quitar
  const processedInDrag = useRef<Set<string>>(new Set()); // Celdas procesadas en este arrastre

  const handleDown = (key: string, cell: ScheduleCell) => {
    if (mode !== 'tutor' || !onToggle) return;

    mouseDown.current = true;
    processedInDrag.current = new Set();
    
    // Determinar el modo de pintura basado en si la celda está seleccionada
    const isCurrentlySelected = selectedKeys?.has(key) || false;
    paintMode.current = isCurrentlySelected ? 'deselect' : 'select';
    
    // Aplicar toggle a la primera celda
    processedInDrag.current.add(key);
    onToggle(key, cell);
  };

  const handleEnter = (key: string, cell: ScheduleCell) => {
    if (!mouseDown.current || mode !== 'tutor' || !onToggle) return;
    
    // Si ya procesamos esta celda en este arrastre, no hacer nada
    if (processedInDrag.current.has(key)) return;
    
    processedInDrag.current.add(key);
    
    // Aplicar toggle solo si el estado actual coincide con el modo de pintura
    const isCurrentlySelected = selectedKeys?.has(key) || false;
    
    if ((paintMode.current === 'select' && !isCurrentlySelected) ||
        (paintMode.current === 'deselect' && isCurrentlySelected)) {
      // En modo 'select' añadimos si no está seleccionada; en 'deselect' quitamos si está seleccionada
      onToggle(key, cell);
    }
  };

  const handleUp = () => {
    mouseDown.current = false;
    paintMode.current = null;
    processedInDrag.current.clear();
  };

  const handleClick = (key: string, cell: ScheduleCell) => {
    // Solo para modo estudiante
    if (mode === 'student') {
      const canPick = cell.status === 'DISPONIBLE';
      if (canPick && onSinglePick) {
        onSinglePick(cell);
      }
    }
  };

  const renderCell = (d: string, h: string) => {
    const key = `${d}_${h}`;
    const cell = map.get(key) || { date: d, hour: h, status: null, reservationId: null, studentId: null };
    const isSelected = !!selectedKeys?.has(key);
    const canPick = mode === 'student' ? cell.status === 'DISPONIBLE' : true;

    const css = [
      classForStatus(cell.status),
      isSelected ? 'selected' : '',
      canPick ? 'can-pick' : 'not-pickable'
    ].join(' ').trim();

    const label = getStatusLabel(cell.status);

    return (
      <button
        key={key}
        type="button"
        className={css}
        onMouseDown={(e) => {
          e.preventDefault(); // Prevenir selección de texto
          handleDown(key, cell);
        }}
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

  return (
    <div 
      className="calendar-wrapper" 
      role="group"
      aria-label="Week calendar"
      tabIndex={0}
      onMouseLeave={() => {
        mouseDown.current = false;
        paintMode.current = null;
        processedInDrag.current.clear();
      }}
      onMouseUp={handleUp}
      onTouchEnd={handleUp}
      onKeyDown={(e) => {
        // Support keyboard users: Esc ends any drag/paint operation
        if (e.key === 'Escape' || e.key === 'Esc') {
          handleUp();
        }
      }}
    >
      <div className="calendar-toolbar">
        <button className="nav-btn" onClick={onPrevWeek}>&laquo;</button>
        <div className="calendar-title">
          Semana {days[0]} &mdash; {days[6]}
        </div>
        <button className="nav-btn" onClick={onNextWeek}>&raquo;</button>
      </div>

      <div className="calendar-grid">
        <div className="col hour-col">
          <div className="head-cell">Hora</div>
          {H_LIST.map(h => <div key={h} className="hour-cell">{h}</div>)}
        </div>

        {days.map((d, idx) => (
          <div key={d} className="col">
            <div className="head-cell">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][idx]}<br/>{d}</div>
            {H_LIST.map(h => renderCell(d, h))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeekCalendar;