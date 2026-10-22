export const shortZones = [
  ['UTC', 'UTC'], ['GMT', 'GMT · UTC+0'], ['BST', 'BST · UTC+1'],
  ['EDT', 'EDT · UTC−4'], ['EST', 'EST · UTC−5'],
  ['MDT', 'MDT · UTC−6'], ['MST', 'MST · UTC−7'],
  ['PDT', 'PDT · UTC−7'], ['PST', 'PST · UTC−8'],
  ['CET', 'CET · UTC+1'], ['CEST', 'CEST · UTC+2'],
  ...Array.from({ length: 27 }, (_, i) => {
    const hour = i - 12;
    const zone = `UTC${hour < 0 ? '' : '+'}${hour}`;
    return [zone, zone];
  }),
  ...['UTC+5:30', 'UTC+5:45', 'UTC+9:30', 'UTC+12:45'].map(zone => [zone, zone])
] as const;

const popularCities = [
  'America/New_York', 'America/Denver', 'America/Los_Angeles',
  'Europe/Berlin', 'Europe/London', 'Asia/Tokyo', 'Asia/Dubai',
  'Asia/Kolkata', 'Australia/Sydney'
];

export const cityZones = [...new Set([
  ...popularCities,
  ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])
])];

const names: Record<string, number> = {
  UTC: 0, GMT: 0, BST: 60, EDT: -240, EST: -300,
  MDT: -360, MST: -420, PDT: -420, PST: -480, CET: 60, CEST: 120
};

export function fixedOffset(zone: string): number | null {
  if (Object.hasOwn(names, zone.toUpperCase())) return names[zone.toUpperCase()];
  const match = /^UTC([+-])(\d{1,2})(?::([0-5]\d))?$/i.exec(zone);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  const signed = match[1] === '-' ? -minutes : minutes;
  return signed >= -720 && signed <= 840 ? signed : null;
}

export function validZone(zone: string): boolean {
  if (!zone || zone.length > 80) return false;
  if (fixedOffset(zone) !== null) return true;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; }
  catch { return false; }
}

export function readZoneCookie(): string {
  const raw = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('vtime_timezone='));
  if (!raw) return '';
  try { return decodeURIComponent(raw.slice('vtime_timezone='.length)); }
  catch { return ''; }
}

export function saveZoneCookie(zone: string) {
  if (!validZone(zone)) return;
  document.cookie = `vtime_timezone=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

export function defaultViewerZone(): string {
  const saved = readZoneCookie();
  if (validZone(saved)) return saved;
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return validZone(local) ? local : 'UTC';
}
