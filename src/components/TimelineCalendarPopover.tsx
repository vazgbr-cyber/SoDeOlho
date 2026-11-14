import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { getItemPrimaryDateString } from '../lib/dateUtils';

interface TimelineCalendarPopoverProps {
  items: MediaItem[];
  onJumpToDate: (targetDate: Date, mode: 'day' | 'month' | 'year') => void;
  onJumpToToday: () => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const TimelineCalendarPopover: React.FC<TimelineCalendarPopoverProps> = ({
  items,
  onJumpToDate,
  onJumpToToday,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerView, setPickerView] = useState<'days' | 'months' | 'years'>('days');

  const now = new Date();
  const [cursorYear, setCursorYear] = useState(now.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(now.getMonth());

  // Mapeia quais dias, meses e anos possuem lançamentos para exibir indicadores neon
  const releaseMarkers = useMemo(() => {
    const daysSet = new Set<string>();
    const monthsSet = new Set<string>();
    const yearsSet = new Set<number>();

    for (const item of items) {
      const raw = getItemPrimaryDateString(item);
      if (!raw) continue;
      const clean = raw.length === 10 ? `${raw}T12:00:00` : raw;
      const d = new Date(clean);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();

      yearsSet.add(y);
      monthsSet.add(`${y}-${m}`);
      daysSet.add(`${y}-${m}-${day}`);
    }

    return { daysSet, monthsSet, yearsSet };
  }, [items]);

  const yearsRange = useMemo(() => {
    const currentY = new Date().getFullYear();
    const list: number[] = [];
    for (let y = currentY - 4; y <= currentY + 2; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(cursorYear, cursorMonth, 1).getDay();
    const daysInMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();

    const cells: Array<number | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [cursorYear, cursorMonth]);

  const handlePrev = () => {
    if (pickerView === 'days') {
      if (cursorMonth === 0) {
        setCursorMonth(11);
        setCursorYear((y) => y - 1);
      } else {
        setCursorMonth((m) => m - 1);
      }
    } else if (pickerView === 'months') {
      setCursorYear((y) => y - 1);
    }
  };

  const handleNext = () => {
    if (pickerView === 'days') {
      if (cursorMonth === 11) {
        setCursorMonth(0);
        setCursorYear((y) => y + 1);
      } else {
        setCursorMonth((m) => m + 1);
      }
    } else if (pickerView === 'months') {
      setCursorYear((y) => y + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const target = new Date(cursorYear, cursorMonth, day, 0, 0, 0);
    onJumpToDate(target, 'day');
    setIsOpen(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    setCursorMonth(monthIndex);
    const target = new Date(cursorYear, monthIndex, 1, 0, 0, 0);
    onJumpToDate(target, 'month');
    setPickerView('days');
  };

  const handleSelectYear = (year: number) => {
    setCursorYear(year);
    const target = new Date(year, 0, 1, 0, 0, 0);
    onJumpToDate(target, 'year');
    setPickerView('months');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
          isOpen
            ? 'bg-[#2a174a] text-[#c084fc] border-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.35)]'
            : 'bg-[#130f1d] text-[#c4bcd6] border-white/[0.08] hover:border-[#a855f7]/60 hover:text-white'
        }`}
        title="Navegar rapidamente por dia, mês ou ano na linha do tempo"
      >
        <CalendarIcon className="w-4 h-4 text-[#a855f7]" />
        <span>Pular para Data</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-72 sm:w-80 z-40 rounded-2xl bg-[#120e1c] border border-[#a855f7]/45 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(168,85,247,0.2)] p-4 select-none">
          {/* Topo do Mini-Calendário: Alternadores Dia / Mês / Ano */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.07]">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#09070e] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setPickerView('days')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  pickerView === 'days'
                    ? 'bg-[#2a174a] text-[#c084fc]'
                    : 'text-[#7c738f] hover:text-white'
                }`}
              >
                Dias
              </button>
              <button
                type="button"
                onClick={() => setPickerView('months')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  pickerView === 'months'
                    ? 'bg-[#2a174a] text-[#c084fc]'
                    : 'text-[#7c738f] hover:text-white'
                }`}
              >
                Meses
              </button>
              <button
                type="button"
                onClick={() => setPickerView('years')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  pickerView === 'years'
                    ? 'bg-[#2a174a] text-[#c084fc]'
                    : 'text-[#7c738f] hover:text-white'
                }`}
              >
                Anos
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-[#7c738f] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barra de Navegação do Período Atual */}
          {pickerView !== 'years' && (
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#a855f7]/20 text-[#c4bcd6] hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setPickerView(pickerView === 'days' ? 'months' : 'years')
                }
                className="text-xs sm:text-sm font-extrabold text-white hover:text-[#c084fc] transition"
              >
                {pickerView === 'days'
                  ? `${MONTH_NAMES[cursorMonth]} ${cursorYear}`
                  : `${cursorYear}`}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#a855f7]/20 text-[#c4bcd6] hover:text-white transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MODO 1: GRADE DE DIAS */}
          {pickerView === 'days' && (
            <div>
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold text-[#655d78]"
                  >
                    {w}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-8" />;
                  }

                  const hasRelease = releaseMarkers.daysSet.has(
                    `${cursorYear}-${cursorMonth}-${day}`
                  );
                  const isToday =
                    cursorYear === now.getFullYear() &&
                    cursorMonth === now.getMonth() &&
                    day === now.getDate();

                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => handleSelectDay(day)}
                      className={`relative h-8 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition ${
                        isToday
                          ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]'
                          : hasRelease
                          ? 'bg-[#0d3320]/80 text-[#4ade80] border border-[#22ff55]/40 hover:bg-[#0d3320]'
                          : 'text-[#c4bcd6] hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span>{day}</span>
                      {hasRelease && (
                        <span className="w-1 h-1 rounded-full bg-[#22ff55] shadow-[0_0_6px_#22ff55]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODO 2: GRADE DE MESES */}
          {pickerView === 'months' && (
            <div className="grid grid-cols-3 gap-2 py-1">
              {MONTH_SHORT.map((mName, idx) => {
                const hasRelease = releaseMarkers.monthsSet.has(
                  `${cursorYear}-${idx}`
                );
                const isCurrent =
                  cursorYear === now.getFullYear() && idx === now.getMonth();

                return (
                  <button
                    type="button"
                    key={mName}
                    onClick={() => handleSelectMonth(idx)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      isCurrent
                        ? 'bg-[#2a174a] text-[#c084fc] border-[#a855f7]'
                        : hasRelease
                        ? 'bg-[#0d3320]/60 text-[#4ade80] border-[#22ff55]/35 hover:border-[#22ff55]'
                        : 'bg-[#09070e] text-[#968da8] border-white/[0.05] hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span>{mName}</span>
                    {hasRelease && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22ff55]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* MODO 3: GRADE DE ANOS */}
          {pickerView === 'years' && (
            <div className="grid grid-cols-3 gap-2 py-1">
              {yearsRange.map((year) => {
                const hasRelease = releaseMarkers.yearsSet.has(year);
                const isCurrent = year === now.getFullYear();

                return (
                  <button
                    type="button"
                    key={year}
                    onClick={() => handleSelectYear(year)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition ${
                      isCurrent
                        ? 'bg-[#2a174a] text-[#c084fc] border-[#a855f7]'
                        : hasRelease
                        ? 'bg-[#0d3320]/60 text-[#4ade80] border-[#22ff55]/35 hover:border-[#22ff55]'
                        : 'bg-[#09070e] text-[#968da8] border-white/[0.05] hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span>{year}</span>
                    {hasRelease && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22ff55]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Rodapé do Mini-Calendário: Legenda + Botão "Ir para Hoje" */}
          <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-[#8e86a3]">
              <span className="w-2 h-2 rounded-full bg-[#22ff55] shadow-[0_0_6px_#22ff55]" />
              <span>Datas com mídia</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setCursorYear(now.getFullYear());
                setCursorMonth(now.getMonth());
                onJumpToToday();
                setIsOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#1c142e] text-[#c084fc] hover:text-white border border-[#a855f7]/40 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Ir para Hoje</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
