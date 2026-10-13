const $ = id => document.getElementById(id);
let csrf = '';
let staff = [];
let totalStaff = 0;
let editingId = null;
const ZONE_COOKIE = 'vtime_timezone';

function savedTimeZone() {
  const raw = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${ZONE_COOKIE}=`));
  if (!raw) return '';
  try { return decodeURIComponent(raw.slice(ZONE_COOKIE.length + 1)); }
  catch { return ''; }
}

function saveTimeZone(zone) {
  if (!zone) return;
  document.cookie = `${ZONE_COOKIE}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function localDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function showError(id, message = '') {
  const element = $(id);
  element.textContent = message;
  element.hidden = !message;
}

function showLogin() {
  $('loginView').hidden = false;
  $('panelView').hidden = true;
  $('logout').hidden = true;
  csrf = '';
}

function showPanel() {
  $('loginView').hidden = true;
  $('panelView').hidden = false;
  $('logout').hidden = false;
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.method && options.method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf;
  let response;
  try { response = await fetch(url, { ...options, headers, credentials: 'same-origin' }); }
  catch { throw new Error('Cannot reach the server.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login') showLogin();
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

async function fillRoles() {
  const { roles } = await api('/api/roles');
  const select = $('staffRole');
  select.length = 1;
  for (const role of roles) select.add(new Option(role, role));
}

function fillTimeZones() {
  const short = [
    ['UTC', 'UTC'], ['BST', 'BST · UTC+1'], ['EDT', 'EDT · UTC−4'], ['EST', 'EST · UTC−5'],
    ['MDT', 'MDT · UTC−6'], ['MST', 'MST · UTC−7'],
    ['PDT', 'PDT · UTC−7'], ['PST', 'PST · UTC−8'],
    ['CET', 'CET · UTC+1'], ['CEST', 'CEST · UTC+2'],
    ...Array.from({ length: 27 }, (_, i) => {
      const hour = i - 12;
      const zone = `UTC${hour < 0 ? '' : '+'}${hour}`;
      return [zone, zone];
    }),
    ...['UTC+5:30', 'UTC+5:45', 'UTC+9:30', 'UTC+12:45'].map(zone => [zone, zone])
  ];
  const popularCities = ['America/New_York', 'America/Denver', 'America/Los_Angeles',
    'Europe/Berlin', 'Europe/London', 'Asia/Tokyo', 'Asia/Dubai',
    'Asia/Kolkata', 'Australia/Sydney'];
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const cities = [...new Set([...popularCities, ...supported])];
  for (const id of ['staffZone', 'viewerZone']) {
    const select = $(id);
    if (id === 'staffZone') select.add(new Option('Select a time zone', '', true, true));
    const shortGroup = document.createElement('optgroup');
    shortGroup.label = 'Short time zones & UTC offsets (fixed)';
    for (const [value, label] of short) shortGroup.append(new Option(label, value));
    select.append(shortGroup);
    const cityGroup = document.createElement('optgroup');
    cityGroup.label = 'City time zones (daylight saving aware)';
    for (const zone of cities) cityGroup.append(new Option(zone, zone));
    select.append(cityGroup);
    select.add(new Option('Custom time zone…', '__custom__'));
  }
}

function toggleCustom(selectId, customId) {
  const custom = $(customId);
  custom.hidden = $(selectId).value !== '__custom__';
  custom.required = !custom.hidden && selectId !== 'viewerZone';
}

function choiceValue(selectId, customId) {
  return $(selectId).value === '__custom__' ? $(customId).value.trim() : $(selectId).value;
}

function setChoice(selectId, customId, value) {
  const select = $(selectId);
  if ([...select.options].some(option => option.value === value)) {
    select.value = value;
    $(customId).value = '';
  }
  else {
    select.value = '__custom__';
    $(customId).value = value;
  }
  toggleCustom(selectId, customId);
}

function selectRole(role) {
  const select = $('staffRole');
  const note = $('legacyRoleNote');
  if ([...select.options].some(option => option.value === role)) {
    select.value = role;
    note.hidden = true;
  } else {
    select.value = '';
    note.textContent = `Previous role: ${role}. Choose a role from the list.`;
    note.hidden = false;
  }
}

function fixedOffset(zone) {
  const names = { UTC: 0, GMT: 0, BST: 60, EDT: -240, EST: -300, MDT: -360, MST: -420, PDT: -420, PST: -480, CET: 60, CEST: 120 };
  if (Object.hasOwn(names, zone.toUpperCase())) return names[zone.toUpperCase()];
  const match = /^UTC([+-])(\d{1,2})(?::([0-5]\d))?$/i.exec(zone);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === '-' ? -minutes : minutes;
}

function timeInZone(instant, zone) {
  try {
    const offset = fixedOffset(zone);
    const time = offset === null ? instant : new Date(instant.getTime() + offset * 60000);
    return new Intl.DateTimeFormat('en-GB', { timeZone: offset === null ? zone : 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time);
  } catch { return '—'; }
}

function currentTime(zone) { return timeInZone(new Date(), zone); }

function addText(parent, tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderStaff() {
  const list = $('staffList');
  list.replaceChildren();
  $('teamCount').textContent = staff.length === totalStaff
    ? `${staff.length} ${staff.length === 1 ? 'person' : 'staff'}`
    : `${staff.length} of ${totalStaff} staff`;
  if (!staff.length) {
    addText(list, 'p', 'empty', totalStaff ? 'No staff in this group.' : 'No staff members yet. Add one on the right.');
    return;
  }
  for (const person of staff) {
    const card = document.createElement('article');
    card.className = 'staff-card';
    const top = addText(card, 'div', 'staff-top', '');
    const identity = addText(top, 'div', '', '');
    addText(identity, 'div', 'staff-name', person.name);
    addText(identity, 'div', 'staff-role', person.role || 'Staff');
    addText(identity, 'div', 'staff-id', `Discord: ${person.discord_id}`);
    const time = currentTime(person.time_zone);
    addText(top, 'div', 'staff-time', time);
    const details = addText(card, 'div', 'staff-details', '');
    addText(details, 'span', '', person.time_zone);
    const from = person.available_from.slice(0, 5);
    const until = person.available_until.slice(0, 5);
    addText(details, 'span', '', `${from}–${until} local`);
    const available = time >= from && time < until;
    addText(details, 'span', available ? 'available' : 'unavailable', available ? 'Likely available now' : 'Outside usual hours');
    const actions = addText(card, 'div', 'staff-actions', '');
    const edit = addText(actions, 'button', '', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => editStaff(person));
    const remove = addText(actions, 'button', 'remove', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => removeStaff(person));
    list.append(card);
  }
}

function resetForm() {
  editingId = null;
  $('staffForm').reset();
  $('legacyRoleNote').hidden = true;
  toggleCustom('staffZone', 'staffZoneCustom');
  $('availableFrom').value = '13:00';
  $('availableUntil').value = '21:00';
  $('formTitle').textContent = 'Add a person';
  $('saveStaff').textContent = 'Add staff member';
  $('cancelEdit').hidden = true;
  showError('formError');
}

function editStaff(person) {
  editingId = person.id;
  $('staffName').value = person.name;
  selectRole(person.role || 'Staff');
  $('discordId').value = person.discord_id;
  setChoice('staffZone', 'staffZoneCustom', person.time_zone);
  $('availableFrom').value = person.available_from.slice(0, 5);
  $('availableUntil').value = person.available_until.slice(0, 5);
  $('formTitle').textContent = 'Edit person';
  $('saveStaff').textContent = 'Save changes';
  $('cancelEdit').hidden = false;
  $('staffForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('staffName').focus();
}

async function removeStaff(person) {
  if (!confirm(`Remove ${person.name} from the staff list?`)) return;
  try {
    await api(`/api/staff/${person.id}`, { method: 'DELETE' });
    if (editingId === person.id) resetForm();
    await loadPanel();
  } catch (error) { showError('panelError', error.message); }
}

function renderMeeting(data) {
  const box = $('meetingResult');
  box.replaceChildren();
  addText(box, 'span', 'result-kicker', "YOUR TEAM'S WINDOW");
  if (!data.total) {
    addText(box, 'strong', '', totalStaff ? 'No staff in this group.' : 'Add staff to see an overlap.');
    return;
  }
  if (data.windows.length) {
    const longest = [...data.windows].sort((a, b) => b.minutes - a.minutes)[0];
    addText(box, 'strong', '', `${longest.start} – ${longest.end}`);
    addText(box, 'p', '', `All ${data.total} staff members are likely available during this window in your time zone.`);
    if (data.recommended) addText(box, 'p', '', `Suggested 1-hour meeting: ${data.recommended.start} – ${oneHourLater(data.recommended.startUtc, choiceValue('viewerZone', 'viewerZoneCustom'))}.`);
    if (data.windows.length > 1) {
      const list = addText(box, 'ul', '', '');
      for (const window of data.windows) addText(list, 'li', '', `${window.start} – ${window.end}`);
    }
    return;
  }
  addText(box, 'strong', '', 'No full-team overlap on this date.');
  if (data.bestPartial) addText(box, 'p', '', `Closest window: ${data.bestPartial.start} – ${data.bestPartial.end} (${data.bestPartial.count} of ${data.total} staff likely available).`);
  else addText(box, 'p', '', 'The usual availability windows do not overlap. Try another date or update staff hours.');
}

function oneHourLater(iso, zone) {
  const date = new Date(Date.parse(iso) + 60 * 60 * 1000);
  return timeInZone(date, zone);
}

async function loadAvailability() {
  const date = $('meetingDate').value;
  const zone = choiceValue('viewerZone', 'viewerZoneCustom');
  if (!date || !zone) return;
  try {
    const query = new URLSearchParams({ date, timeZone: zone, group: $('roleFilter').value });
    renderMeeting(await api(`/api/availability?${query}`));
    saveTimeZone(zone);
    showError('panelError');
  } catch (error) { showError('panelError', error.message); }
}

async function loadPanel() {
  const data = await api(`/api/staff?group=${encodeURIComponent($('roleFilter').value)}`);
  staff = data.staff;
  totalStaff = data.total;
  renderStaff();
  await loadAvailability();
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  showError('loginError');
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
    $('password').value = '';
    csrf = data.csrf;
    showPanel();
    await fillRoles();
    await loadPanel();
  } catch (error) {
    showError(csrf ? 'panelError' : 'loginError', error.message);
  }
});

$('logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); }
  catch { /* A local session can still be cleared in the UI. */ }
  showLogin();
});

$('staffForm').addEventListener('submit', async event => {
  event.preventDefault();
  showError('formError');
  const payload = {
    name: $('staffName').value,
    role: $('staffRole').value,
    discordId: $('discordId').value,
    timeZone: choiceValue('staffZone', 'staffZoneCustom'),
    availableFrom: $('availableFrom').value,
    availableUntil: $('availableUntil').value
  };
  try {
    await api(editingId ? `/api/staff/${editingId}` : '/api/staff', {
      method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    resetForm();
    await loadPanel();
  } catch (error) { showError('formError', error.message); }
});

$('cancelEdit').addEventListener('click', resetForm);
$('meetingDate').addEventListener('change', loadAvailability);
$('staffRole').addEventListener('change', () => { $('legacyRoleNote').hidden = true; });
$('roleFilter').addEventListener('change', () => loadPanel().catch(error => showError('panelError', error.message)));
$('staffZone').addEventListener('change', () => toggleCustom('staffZone', 'staffZoneCustom'));
$('viewerZone').addEventListener('change', () => { toggleCustom('viewerZone', 'viewerZoneCustom'); loadAvailability(); });
$('viewerZoneCustom').addEventListener('change', loadAvailability);
setInterval(renderStaff, 60 * 1000);
fillTimeZones();
$('meetingDate').value = localDate();
setChoice('viewerZone', 'viewerZoneCustom', savedTimeZone() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
api('/api/me').then(data => {
  if (!data.authenticated) return showLogin();
  csrf = data.csrf;
  showPanel();
  fillRoles().then(loadPanel).catch(error => showError('panelError', error.message));
}).catch(error => {
  showLogin();
  showError('loginError', error.message);
});
