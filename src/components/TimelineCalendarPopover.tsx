import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { getItemPrimaryDateString } from '../lib/dateUtils';

export interface CalendarDateFilter {
  mode: 'day' | 'month';
  startDateIso: string; // YYYY-MM-DD
  endDateIso: string;   // YYYY-MM-DD
  label: string;
  rawDate: Date;
}

interface TimelineCalendarPopoverProps {
  items: MediaItem[];
  activeDateFilter: CalendarDateFilter | null;
  onSelectDateFilter: (filter: CalendarDateFilter) => void;
  onClearDateFilter: () => void;
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

function toIsoDate(year: number, monthZeroBased: number, day: number): string {
  const y = String(year);
  const m = String(monthZeroBased + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const TimelineCalendarPopover: React.FC<TimelineCalendarPopoverProps> = ({
  items,
  activeDateFilter,
  onSelectDateFilter,
  onClearDateFilter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerView, setPickerView] = useState<'days' | 'months' | 'years'>('days');

  const now = new Date();
  const [cursorYear, setCursorYear] = useState(now.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(now.getMonth());

  // Mapeia quais dias, meses e anos já possuem lançamentos carregados
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
    for (let y = currentY - 6; y <= currentY + 2; y++) {
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

  // Quando o usuário clica em um DIA específico, busca e mostra TUDO que lançou nessa data
  const handleSelectDay = (day: number) => {
    const iso = toIsoDate(cursorYear, cursorMonth, day);
    const target = new Date(cursorYear, cursorMonth, day, 12, 0, 0);
    const label = target.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    onSelectDateFilter({
      mode: 'day',
      startDateIso: iso,
      endDateIso: iso,
      label,
      rawDate: target,
    });
    setIsOpen(false);
  };

  // Quando o usuário clica para ver todo o mês selecionado
  const handleSelectWholeMonth = (monthIndex: number) => {
    const daysInMonth = new Date(cursorYear, monthIndex + 1, 0).getDate();
    const startIso = toIsoDate(cursorYear, monthIndex, 1);
    const endIso = toIsoDate(cursorYear, monthIndex, daysInMonth);
    const target = new Date(cursorYear, monthIndex, 1, 12, 0, 0);
    const label = `${MONTH_NAMES[monthIndex]} de ${cursorYear}`;

    onSelectDateFilter({
      mode: 'month',
      startDateIso: startIso,
      endDateIso: endIso,
      label,
      rawDate: target,
    });
    setIsOpen(false);
  };

  const handleNavigateToMonthDays = (monthIndex: number) => {
    setCursorMonth(monthIndex);
    setPickerView('days');
  };

  const handleNavigateToYearMonths = (year: number) => {
    setCursorYear(year);
    setPickerView('months');
  };

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
          activeDateFilter
            ? 'bg-[#0d3320] text-[#4ade80] border-[#22ff55] shadow-[0_0_16px_rgba(34,255,85,0.3)]'
            : isOpen
            ? 'bg-[#2a174a] text-[#c084fc] border-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.35)]'
            : 'bg-[#130f1d] text-[#c4bcd6] border-white/[0.08] hover:border-[#a855f7]/60 hover:text-white'
        }`}
        title="Abrir calendário para ver tudo o que lançou em uma data específica"
      >
        <CalendarIcon
          className={`w-4 h-4 ${
            activeDateFilter ? 'text-[#22ff55]' : 'text-[#a855f7]'
          }`}
        />
        <span>
          {activeDateFilter ? `Data: ${activeDateFilter.label}` : 'Calendário de Datas'}
        </span>
      </button>

      {activeDateFilter && (
        <button
          type="button"
          onClick={onClearDateFilter}
          title="Limpar filtro de data e voltar para os lançamentos de hoje em diante"
          className="p-2 rounded-xl bg-[#1a1128] text-[#c084fc] hover:text-white border border-[#a855f7]/40 hover:border-[#22ff55] transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-88 z-40 rounded-2xl bg-[#120e1c] border border-[#a855f7]/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(168,85,247,0.25)] p-4 select-none">
          {/* Topo do Calendário: Alternadores Dia / Mês / Ano */}
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

          <p className="text-[11px] text-[#968da8] mb-2.5">
            Clique em qualquer dia para buscar <strong>tudo o que lançou</strong> naquela data:
          </p>

          {/* Barra de Navegação do Mês / Ano */}
          {pickerView !== 'years' && (
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#a855f7]/20 text-[#c4bcd6] hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
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
              </div>

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
            <div className="space-y-2.5">
              <div className="grid grid-cols-7 gap-1 text-center">
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

                  const iso = toIsoDate(cursorYear, cursorMonth, day);
                  const isSelectedDay =
                    activeDateFilter?.mode === 'day' &&
                    activeDateFilter.startDateIso === iso;
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
                        isSelectedDay
                          ? 'bg-[#22ff55] text-[#09070e] font-black shadow-[0_0_12px_#22ff55]'
                          : isToday
                          ? 'bg-[#2a174a] text-[#c084fc] border border-[#a855f7]'
                          : hasRelease
                          ? 'bg-[#0d3320]/80 text-[#4ade80] border border-[#22ff55]/40 hover:bg-[#0d3320]'
                          : 'text-[#c4bcd6] hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <span>{day}</span>
                      {hasRelease && !isSelectedDay && (
                        <span className="w-1 h-1 rounded-full bg-[#22ff55] shadow-[0_0_6px_#22ff55]" />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleSelectWholeMonth(cursorMonth)}
                className="w-full py-2 px-3 rounded-xl text-[11px] font-bold bg-[#1a122b] hover:bg-[#2a174a] text-[#c084fc] border border-[#a855f7]/35 transition"
              >
                Ver todos os lançamentos de {MONTH_NAMES[cursorMonth]} / {cursorYear}
              </button>
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
                    onClick={() => handleNavigateToMonthDays(idx)}
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
                    onClick={() => handleNavigateToYearMonths(year)}
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

          {/* Rodapé do Mini-Calendário */}
          <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleSelectDay(now.getDate())}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#0d3320] text-[#4ade80] border border-[#22ff55]/40 hover:border-[#22ff55]"
            >
              Ver lançamentos de Hoje
            </button>

            <button
              type="button"
              onClick={() => {
                setCursorYear(now.getFullYear());
                setCursorMonth(now.getMonth());
                onClearDateFilter();
                setIsOpen(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#1c142e] text-[#c084fc] hover:text-white border border-[#a855f7]/40 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Cronograma Normal</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
