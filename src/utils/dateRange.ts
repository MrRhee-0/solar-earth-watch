const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function lastUtcDays(days: number, now = new Date()): DateRange {
  const end = new Date(now);
  const start = new Date(end.getTime() - days * DAY_MS);

  return {
    startDate: formatUtcDate(start),
    endDate: formatUtcDate(end)
  };
}

export function addHours(isoTime: string, hours: number): Date | null {
  const startMs = parseUtcTime(isoTime);
  if (Number.isNaN(startMs)) {
    return null;
  }

  return new Date(startMs + hours * 60 * 60 * 1000);
}

export function formatUtcTimestamp(isoTime?: string | null): string {
  if (!isoTime) {
    return "unavailable witness";
  }

  const date = new Date(parseUtcTime(isoTime));
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }

  return date.toISOString().replace(".000Z", "Z");
}

export function shortUtc(isoTime?: string | null): string {
  if (!isoTime) {
    return "-";
  }

  const date = new Date(parseUtcTime(isoTime));
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }

  return `${date.toISOString().slice(5, 10)} ${date
    .toISOString()
    .slice(11, 16)}Z`;
}

export function parseUtcTime(timeTag: string): number {
  const trimmed = timeTag.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = hasTimezone
    ? trimmed
    : `${trimmed.replace(" ", "T")}Z`;

  return Date.parse(normalized);
}
