import { fixedOffset } from './zones';

type Parts = [number, number, number, number, number, number];

function partsAt(instant: Date, zone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const p = Object.fromEntries(formatter.formatToParts(instant)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return [p.year, p.month, p.day, p.hour, p.minute, p.second];
}

function offsetAt(ms: number, zone: string): number {
  const fixed = fixedOffset(zone);
  if (fixed !== null) return fixed;
  const p = partsAt(new Date(ms), zone);
  return Math.round((Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]) - ms) / 60000);
}

function partsInZone(ms: number, zone: string): Parts {
  const fixed = fixedOffset(zone);
  return fixed === null ? partsAt(new Date(ms), zone) : partsAt(new Date(ms + fixed * 60000), 'UTC');
}

function sourceToInstant(y: number, m: number, d: number, h: number, minute: number, zone: string) {
  const naive = Date.UTC(y, m - 1, d, h, minute);
  const fixed = fixedOffset(zone);
  if (fixed !== null) return { ms: naive - fixed * 60000, ambiguous: false };
  const offsets = new Set([-129600000, 0, 129600000].map(delta => offsetAt(naive + delta, zone)));
  const matches = [...offsets].map(offset => naive - offset * 60000).filter(ms => {
    const p = partsInZone(ms, zone);
    return p[0] === y && p[1] === m && p[2] === d && p[3] === h && p[4] === minute;
  }).sort((a, b) => a - b);
  if (!matches.length) throw new Error('This time does not exist because clocks move forward. Choose another time.');
  return { ms: matches[0], ambiguous: matches.length > 1 };
}

function offsetLabel(minutes: number) {
  const sign = minutes < 0 ? '−' : '+';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${Math.floor(absolute / 60)}${absolute % 60 ? ':' + String(absolute % 60).padStart(2, '0') : ''}`;
}

export function convert(date: string, time: string, fromZone: string, toZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, minute] = time.split(':').map(Number);
  const source = sourceToInstant(y, m, d, h, minute, fromZone);
  const p = partsInZone(source.ms, toZone);
  const resultTime = `${String(p[3]).padStart(2, '0')}:${String(p[4]).padStart(2, '0')}`;
  const resultDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
  const sourceOffset = offsetAt(source.ms, fromZone);
  const targetOffset = offsetAt(source.ms, toZone);
  const difference = targetOffset - sourceOffset;
  return {
    time: resultTime,
    date: resultDate,
    fromDetail: `${offsetLabel(sourceOffset)} on this date`,
    toDetail: `${offsetLabel(targetOffset)} on this date`,
    difference: difference === 0 ? 'same time' : `${Math.abs(difference / 60).toLocaleString('en-US', { maximumFractionDigits: 2 })} hours ${difference > 0 ? 'ahead' : 'behind'}`,
    ambiguous: source.ambiguous,
    instant: source.ms,
    targetParts: p
  };
}

export function timeInZone(instant: Date, zone: string) {
  const p = partsInZone(instant.getTime(), zone);
  return `${String(p[3]).padStart(2, '0')}:${String(p[4]).padStart(2, '0')}`;
}
