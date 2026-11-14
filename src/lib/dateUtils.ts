import { MediaItem } from '../types/media';

/**
 * Retorna a string de data principal (YYYY-MM-DD ou ISO) de um MediaItem
 */
export function getItemPrimaryDateString(item: MediaItem): string | null {
  if (item.category === 'tv' || item.category === 'anime') {
    return item.nextEpisodeDate || item.sortEventDate || null;
  }
  if (item.category === 'movie_digital') {
    return item.digitalReleaseDate || item.cinemaReleaseDate || item.sortEventDate || null;
  }
  if (item.category === 'movie_cinema') {
    return item.cinemaReleaseDate || item.sortEventDate || null;
  }
  return item.releaseDate || item.cinemaReleaseDate || item.sortEventDate || null;
}

/**
 * Retorna o timestamp (ms) da data de lançamento/exibição do item
 */
export function getItemReleaseTimestamp(item: MediaItem): number {
  const raw = getItemPrimaryDateString(item);
  if (!raw) return Number.MAX_SAFE_INTEGER;
  const clean = raw.length === 10 ? `${raw}T12:00:00` : raw;
  const ms = new Date(clean).getTime();
  return isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

/**
 * Retorna o início do dia de hoje (00:00:00 local) em ms
 */
export function getTodayStartTimestamp(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
}

/**
 * Verifica se o item é da data atual de acesso para frente (>= hoje 00:00)
 */
export function isFromTodayOnwards(item: MediaItem): boolean {
  const ts = getItemReleaseTimestamp(item);
  if (ts === Number.MAX_SAFE_INTEGER) return true;
  const raw = getItemPrimaryDateString(item);
  if (!raw) return true;
  const clean = raw.length === 10 ? `${raw}T12:00:00` : raw;
  const d = new Date(clean);
  const itemDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  return itemDayStart >= getTodayStartTimestamp();
}

/**
 * Formata uma string ISO (YYYY-MM-DD ou ISO timestamp) para DD/MM
 */
export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return 'A definir';
  try {
    const clean = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
    const d = new Date(clean);
    if (isNaN(d.getTime())) return 'A definir';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return 'A definir';
  }
}

/**
 * Formata uma string ISO para DD/MM/YYYY
 */
export function formatFullDate(dateStr?: string | null): string {
  if (!dateStr) return 'Ainda não divulgada';
  try {
    const clean = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
    const d = new Date(clean);
    if (isNaN(d.getTime())) return 'Ainda não divulgada';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Ainda não divulgada';
  }
}

/**
 * Formata data e hora completa para episódios de Séries e Animes
 */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Aguardando confirmação';
  try {
    const clean = dateStr.length === 10 ? `${dateStr}T21:00:00` : dateStr;
    const d = new Date(clean);
    if (isNaN(d.getTime())) return 'Aguardando confirmação';
    const datePart = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} às ${timePart}`;
  } catch {
    return 'Aguardando confirmação';
  }
}

/**
 * Calcula quantos dias faltam a partir de hoje
 */
export function getDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  try {
    const todayStart = getTodayStartTimestamp();
    const clean = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
    const target = new Date(clean);
    if (isNaN(target.getTime())) return null;
    const targetStart = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate()
    ).getTime();
    return Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Gera texto de contagem regressiva para episódios (ex: "Ep. 06 em 2 dias" ou "Ep. 12 Hoje!")
 */
export function formatEpisodeCountdown(
  epNumber?: number | null,
  nextDateStr?: string | null
): string {
  const epPrefix = epNumber
    ? `Ep. ${String(epNumber).padStart(2, '0')}`
    : 'Episódio';
  const days = getDaysUntil(nextDateStr);

  if (days === null) {
    return `${epPrefix} • Em breve`;
  }
  if (days < 0) {
    return `${epPrefix} • Lançado há ${Math.abs(days)}d`;
  }
  if (days === 0) {
    return `${epPrefix} • Hoje!`;
  }
  if (days === 1) {
    return `${epPrefix} em 1 dia`;
  }
  return `${epPrefix} em ${days} dias`;
}

/**
 * Mantém compatibilidade com a ordenação cronológica
 */
export function getNearestEventTimestamp(item: MediaItem): number {
  return getItemReleaseTimestamp(item);
}

export function getFavoriteEventSummary(item: MediaItem): {
  label: string;
  daysLeft: number | null;
} {
  const raw = getItemPrimaryDateString(item);
  const days = getDaysUntil(raw);

  if (item.category === 'tv' || item.category === 'anime') {
    return {
      label: formatEpisodeCountdown(item.nextEpisodeNumber, item.nextEpisodeDate),
      daysLeft: days,
    };
  }

  if (item.category === 'movie_digital') {
    if (item.isDigitalAvailable && (days === null || days <= 0)) {
      return { label: 'Disponível no Digital', daysLeft: days ?? 0 };
    }
    return {
      label: `Digital: ${formatShortDate(item.digitalReleaseDate)}`,
      daysLeft: days,
    };
  }

  if (item.category === 'movie_cinema') {
    return {
      label: `Cinema: ${formatShortDate(item.cinemaReleaseDate)}`,
      daysLeft: days,
    };
  }

  return {
    label: `Estreia: ${formatShortDate(item.releaseDate)}`,
    daysLeft: days,
  };
}
