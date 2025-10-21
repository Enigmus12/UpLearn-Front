import React, { useMemo, useRef } from 'react';
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
  return dt.toISOString().slice(0, 10); // seguro en UTC
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
    case 'ACTIVA': return 'cell active';
    case 'ACEPTADO': return 'cell accepted';
    case 'CANCELADO': return 'cell canceled';
    default: return 'cell disabled';
  }
}

function getStatusLabel(status: CellStatus | undefined | null): string {
  switch (status) {
    case 'DISPONIBLE': return 'Disponible';
    case 'ACTIVA': return 'Activa';
    case 'ACEPTADO': return 'Aceptada';
    case 'CANCELADO': return 'Cancelada';
    default: return '';
  }
}

const H_LIST = hours();

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  weekStart, cells, mode, selectedKeys, onToggle, onSinglePick, onPrevWeek, onNextWeek, onClear
}) => {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const map = useMemo(() => {
    // prioridad sin incluir null como clave
    const priority: Record<Exclude<CellStatus, null>, number> = {
      ACEPTADO: 4,
      ACTIVA: 3,
      DISPONIBLE: 2,
      CANCELADO: 1,
    };
    const pr = (s: CellStatus | null | undefined) => (s ? priority[s] ?? 0 : 0);

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

  const handleDown = (key: string, cell: ScheduleCell) => {
    if (mode !== 'tutor' || !onToggle) return;

    // IMPORTANTE: Reiniciar el estado de arrastre completamente
    mouseDown.current = true;
    processedInDrag.current = new Set(); // Limpiar las celdas procesadas del arrastre anterior

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

    // Aplicar toggle basado en el modo de pintura establecido al inicio del drag
    const isCurrentlySelected = selectedKeys?.has(key) || false;

    // Solo aplicar toggle si el estado actual de la celda necesita cambiar según el paintMode
    if ((paintMode.current === 'select' && !isCurrentlySelected) ||
      (paintMode.current === 'deselect' && isCurrentlySelected)) {
      onToggle(key, cell);
    }
  };

  const handleUp = () => {
    // CRÍTICO: Limpiar el estado completamente cuando se suelta el mouse
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

  // IMPORTANTE: Agregar listeners globales para asegurar que handleUp siempre se ejecute
  React.useEffect(() => {
    const globalHandleUp = () => {
      if (mouseDown.current) {
        handleUp();
      }
    };

    globalThis.addEventListener('mouseup', globalHandleUp);
    globalThis.addEventListener('touchend', globalHandleUp);

    return () => {
      globalThis.removeEventListener('mouseup', globalHandleUp);
      globalThis.removeEventListener('touchend', globalHandleUp);
    };
  }, []);

  return (
    <fieldset
      className="calendar-wrapper"
      aria-label="Week calendar"
    >
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