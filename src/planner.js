const STEP_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const formatters = new Map();

const fixedNames = { UTC: 0, GMT: 0, BST: 60, EDT: -240, EST: -300, MDT: -360, MST: -420, PDT: -420, PST: -480, CET: 60, CEST: 120 };

export function fixedOffset(zone) {
  if (typeof zone !== 'string') return null;
  const upper = zone.toUpperCase();
  if (Object.hasOwn(fixedNames, upper)) return fixedNames[upper];
  const legacy = /^fixed:(-?\d{1,4})$/.exec(zone);
  if (legacy) {
    const minutes = Number(legacy[1]);
    return minutes >= -720 && minutes <= 840 ? minutes : null;
  }
  const match = /^UTC([+-])(\d{1,2})(?::([0-5]\d))?$/i.exec(zone);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  const signed = match[1] === '-' ? -minutes : minutes;
  return signed >= -720 && signed <= 840 ? signed : null;
}

export function isValidTimeZone(zone) {
  if (typeof zone !== 'string' || zone.length > 80) return false;
  if (fixedOffset(zone) !== null) return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function localParts(instant, zone) {
  const offset = fixedOffset(zone);
  const effectiveZone = offset === null ? zone : 'UTC';
  const effectiveInstant = offset === null ? instant : instant + offset * 60000;
  let formatter = formatters.get(effectiveZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: effectiveZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    formatters.set(effectiveZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(effectiveInstant))
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    hour: parts.hour,
    minute: parts.minute
  };
}

function minutes(time) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!match) throw new Error('Invalid availability time');
  return Number(match[1]) * 60 + Number(match[2]);
}

function clock(instant, zone, selectedDate) {
  const part = localParts(instant, zone);
  const value = `${String(part.hour).padStart(2, '0')}:${String(part.minute).padStart(2, '0')}`;
  return part.date === selectedDate ? value : `${value} (+1 day)`;
}

function makeWindow(start, end, count, zone, date) {
  return {
    start: clock(start, zone, date),
    end: clock(end, zone, date),
    startUtc: new Date(start).toISOString(),
    endUtc: new Date(end).toISOString(),
    minutes: (end - start) / 60000,
    count
  };
}

function spans(samples, predicate, count, zone, date) {
  const output = [];
  let start = null;
  let previous = null;
  for (const sample of samples) {
    if (predicate(sample)) {
      if (start === null) start = sample.instant;
      previous = sample.instant;
    } else if (start !== null) {
      output.push(makeWindow(start, previous + STEP_MS, count, zone, date));
      start = null;
      previous = null;
    }
  }
  if (start !== null) output.push(makeWindow(start, previous + STEP_MS, count, zone, date));
  return output;
}

export function calculateAvailability(staff, date, viewerZone) {
  if (!isValidDate(date) || !isValidTimeZone(viewerZone)) throw new Error('Invalid date or time zone');
  if (!Array.isArray(staff) || staff.length === 0) return { total: 0, windows: [], recommended: null, bestPartial: null };

  const bounds = staff.map(person => ({
    timeZone: person.time_zone,
    from: minutes(person.available_from),
    until: minutes(person.available_until)
  }));
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  const samples = [];
  for (let instant = utcMidnight - 18 * HOUR_MS; instant < utcMidnight + 42 * HOUR_MS; instant += STEP_MS) {
    if (localParts(instant, viewerZone).date !== date) continue;
    let count = 0;
    for (const person of bounds) {
      const local = localParts(instant, person.timeZone);
      const minute = local.hour * 60 + local.minute;
      if (minute >= person.from && minute < person.until) count++;
    }
    samples.push({ instant, count });
  }

  const windows = spans(samples, sample => sample.count === staff.length, staff.length, viewerZone, date);
  const eligible = windows.filter(window => window.minutes >= 60);
  const recommended = eligible.length
    ? [...eligible].sort((a, b) => b.minutes - a.minutes || a.startUtc.localeCompare(b.startUtc))[0]
    : null;
  const maxCount = Math.max(...samples.map(sample => sample.count));
  const partial = maxCount < staff.length && maxCount > 0
    ? spans(samples, sample => sample.count === maxCount, maxCount, viewerZone, date)
    : [];
  const bestPartial = partial.length
    ? [...partial].sort((a, b) => b.minutes - a.minutes || a.startUtc.localeCompare(b.startUtc))[0]
    : null;
  return { total: staff.length, windows, recommended, bestPartial };
}
