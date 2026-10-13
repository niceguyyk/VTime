const zones = [
  { group: 'Cities (daylight saving aware)', items: [
    ['America/New_York', 'New York · ET'], ['Europe/Berlin', 'Berlin · CET/CEST'], ['Europe/London', 'London · GMT/BST'],
    ['America/Los_Angeles', 'Los Angeles · PT'], ['Asia/Tokyo', 'Tokyo · JST'], ['Asia/Dubai', 'Dubai · GST'],
    ['Asia/Kolkata', 'Mumbai · IST'], ['Australia/Sydney', 'Sydney · AEST/AEDT']
  ]},
  { group: 'Fixed abbreviations', items: [
    ['fixed:-240', 'EDT · UTC−4'], ['fixed:-300', 'EST · UTC−5'], ['fixed:-360', 'CST · UTC−6'],
    ['fixed:-420', 'MST · UTC−7'], ['fixed:-480', 'PST · UTC−8'], ['fixed:0', 'UTC · UTC+0']
  ]},
  { group: 'Fixed UTC offsets', items: Array.from({ length: 27 }, (_, i) => {
    const h = i - 12;
    return [`fixed:${h * 60}`, `UTC${h < 0 ? '−' : '+'}${Math.abs(h)}`];
  }) }
];

const $ = id => document.getElementById(id);
const dateInput = $('date');
const timeInput = $('time');
const fromSelect = $('fromZone');
const toSelect = $('toZone');
const error = $('error');
let copyText = '';
let lastInstant = null;
const ZONE_COOKIE = 'vtime_timezone';

function savedTimeZone() {
  const raw = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${ZONE_COOKIE}=`));
  if (!raw) return '';
  try { return decodeURIComponent(raw.slice(ZONE_COOKIE.length + 1)); }
  catch { return ''; }
}

function saveTimeZone(zone) {
  let saved = zone;
  if (zone.startsWith('fixed:')) {
    const minutes = Number(zone.slice(6));
    saved = `UTC${minutes < 0 ? '-' : '+'}${Math.floor(Math.abs(minutes) / 60)}${Math.abs(minutes) % 60 ? ':' + String(Math.abs(minutes) % 60).padStart(2, '0') : ''}`;
  }
  document.cookie = `${ZONE_COOKIE}=${encodeURIComponent(saved)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function converterZone(zone) {
  if (zone.startsWith('fixed:')) return zone;
  const abbreviations = { UTC: 0, GMT: 0, EDT: -240, EST: -300, MDT: -360, MST: -420, PDT: -420, PST: -480, CET: 60, CEST: 120 };
  if (Object.hasOwn(abbreviations, zone)) return `fixed:${abbreviations[zone]}`;
  const offset = /^UTC([+-])(\d{1,2})(?::([0-5]\d))?$/i.exec(zone);
  if (offset) return `fixed:${(offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3] || 0))}`;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return zone; }
  catch { return ''; }
}

function restoreTimeZone() {
  const zone = converterZone(savedTimeZone());
  if (!zone) return;
  if (![...toSelect.options].some(option => option.value === zone)) {
    const group = toSelect.querySelector(zone.startsWith('fixed:') ? 'optgroup:last-child' : 'optgroup:first-child');
    group.append(new Option(zone.startsWith('fixed:') ? savedTimeZone() : zone, zone));
  }
  toSelect.value = zone;
}

for (const select of [fromSelect, toSelect]) {
  for (const group of zones) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    for (const [value, label] of group.items) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      optgroup.append(option);
    }
    select.append(optgroup);
  }
}

const now = new Date();
dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
fromSelect.value = 'fixed:-240';
toSelect.value = 'fixed:60';
restoreTimeZone();

function partsAt(instant, zone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const p = Object.fromEntries(formatter.formatToParts(instant).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  return [p.year, p.month, p.day, p.hour, p.minute, p.second];
}

function offsetAt(ms, zone) {
  if (zone.startsWith('fixed:')) return Number(zone.slice(6));
  const p = partsAt(new Date(ms), zone);
  return Math.round((Date.UTC(...[p[0], p[1] - 1, p[2], p[3], p[4], p[5]]) - ms) / 60000);
}

function sourceToInstant(y, m, d, h, minute, zone) {
  const naive = Date.UTC(y, m - 1, d, h, minute);
  if (zone.startsWith('fixed:')) return { ms: naive - Number(zone.slice(6)) * 60000, ambiguous: false };
  const offsets = new Set([-129600000, 0, 129600000].map(delta => offsetAt(naive + delta, zone)));
  const matches = [...offsets].map(offset => naive - offset * 60000).filter(ms => {
    const p = partsAt(new Date(ms), zone);
    return p[0] === y && p[1] === m && p[2] === d && p[3] === h && p[4] === minute;
  }).sort((a, b) => a - b);
  if (!matches.length) throw new Error('This time does not exist in the selected zone because the clocks move forward. Choose another time.');
  return { ms: matches[0], ambiguous: matches.length > 1 };
}

function offsetLabel(minutes) {
  const sign = minutes < 0 ? '−' : '+';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${Math.floor(absolute / 60)}${absolute % 60 ? ':' + String(absolute % 60).padStart(2, '0') : ''}`;
}

function targetParts(ms, zone) {
  if (zone.startsWith('fixed:')) return partsAt(new Date(ms + Number(zone.slice(6)) * 60000), 'UTC');
  return partsAt(new Date(ms), zone);
}

function formatDate(p) {
  const local = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(local);
}

function update() {
  error.hidden = true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.value);
  const tm = /^(\d{2}):(\d{2})$/.exec(timeInput.value);
  if (!match || !tm) return;
  const [y, m, d] = match.slice(1).map(Number);
  const [h, minute] = tm.slice(1).map(Number);
  try {
    const converted = sourceToInstant(y, m, d, h, minute, fromSelect.value);
    lastInstant = converted.ms;
    const p = targetParts(converted.ms, toSelect.value);
    const resultTime = `${String(p[3]).padStart(2, '0')}:${String(p[4]).padStart(2, '0')}`;
    const resultDate = formatDate(p);
    const sourceOffset = offsetAt(converted.ms, fromSelect.value);
    const targetOffset = offsetAt(converted.ms, toSelect.value);
    const difference = targetOffset - sourceOffset;
    const diffText = difference === 0 ? 'same time' : `${Math.abs(difference / 60).toLocaleString('en-US', { maximumFractionDigits: 2 })} hours ${difference > 0 ? 'ahead' : 'behind'}`;
    $('resultTime').textContent = resultTime;
    $('resultDate').textContent = resultDate;
    $('fromDetail').textContent = `${offsetLabel(sourceOffset)} on this date`;
    $('toDetail').textContent = `${offsetLabel(targetOffset)} on this date`;
    $('resultFoot').textContent = `${fromSelect.selectedOptions[0].textContent} → ${toSelect.selectedOptions[0].textContent} · ${diffText}${converted.ambiguous ? ' · First occurrence of this repeated time used.' : ''}`;
    copyText = `${resultTime} · ${resultDate} (${toSelect.selectedOptions[0].textContent})`;
    const result = document.querySelector('.result');
    result.classList.remove('pop');
    void result.offsetWidth;
    result.classList.add('pop');
    setTimeout(() => result.classList.remove('pop'), 450);
  } catch (e) {
    lastInstant = null;
    $('resultTime').textContent = '–';
    $('resultDate').textContent = 'Check your input';
    $('resultFoot').textContent = 'Daylight saving time is handled automatically.';
    error.textContent = e.message;
    error.hidden = false;
    copyText = '';
  }
}

for (const element of [dateInput, timeInput, fromSelect, toSelect]) element.addEventListener('change', update);
toSelect.addEventListener('change', () => saveTimeZone(toSelect.value));
for (const element of [dateInput, timeInput]) element.addEventListener('input', update);
$('swap').addEventListener('click', () => {
  const previous = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = previous;
  if (lastInstant !== null) {
    const p = targetParts(lastInstant, fromSelect.value);
    dateInput.value = `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`;
    timeInput.value = `${String(p[3]).padStart(2, '0')}:${String(p[4]).padStart(2, '0')}`;
  }
  update();
});
$('copy').addEventListener('click', async () => {
  if (!copyText) return;
  try {
    await navigator.clipboard.writeText(copyText);
    const button = $('copy');
    button.setAttribute('aria-label', 'Copied!');
    button.title = 'Copied!';
    button.classList.add('copied');
    setTimeout(() => {
      button.setAttribute('aria-label', 'Copy result');
      button.title = 'Copy result';
      button.classList.remove('copied');
    }, 1800);
  } catch {
    error.textContent = 'Copying is not available in this browser.';
    error.hidden = false;
  }
});
update();
