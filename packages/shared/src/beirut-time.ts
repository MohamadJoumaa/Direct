export const TIMEZONE = "Asia/Beirut";

/** Night shift: 00:00–06:00 local (Asia/Beirut). */
export const NIGHT_START_HOUR = 0;
export const NIGHT_END_HOUR = 6;
export const NIGHT_SURCHARGE_USD = 1;

/** Commission work day starts at 07:00 Beirut (independent of night end). */
export const WORK_DAY_START_HOUR = 7;

type BeirutParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function beirutParts(date: Date): BeirutParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function tzOffsetMs(instant: Date): number {
  const p = beirutParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

function beirutCivilToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  const first = asUtc - tzOffsetMs(new Date(asUtc));
  return new Date(asUtc - tzOffsetMs(new Date(first)));
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** Beirut local hour 0–5 inclusive → night surcharge (12am–6am). */
export function isNightShift(date: Date = new Date()): boolean {
  const hour = beirutParts(date).hour;
  return hour >= NIGHT_START_HOUR && hour < NIGHT_END_HOUR;
}

/** Start of the current 07:00→07:00 Beirut work day. */
export function workDayStart(at: Date = new Date()): Date {
  const p = beirutParts(at);
  const day =
    p.hour < WORK_DAY_START_HOUR
      ? addCalendarDays(p.year, p.month, p.day, -1)
      : { year: p.year, month: p.month, day: p.day };
  return beirutCivilToUtc(day.year, day.month, day.day, WORK_DAY_START_HOUR);
}

export function workDayRange(at: Date = new Date()): { start: Date; end: Date } {
  const start = workDayStart(at);
  const p = beirutParts(start);
  const next = addCalendarDays(p.year, p.month, p.day, 1);
  const end = beirutCivilToUtc(next.year, next.month, next.day, WORK_DAY_START_HOUR);
  return { start, end };
}
