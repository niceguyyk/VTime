const $ = id => document.getElementById(id);
let csrf = '';
let staff = [];
let editingId = null;

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

function fillTimeZones() {
  const common = ['UTC', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney'];
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const zones = [...new Set([...common, ...all])];
  const list = $('timeZones');
  for (const zone of zones) {
    const option = document.createElement('option');
    option.value = zone;
    list.append(option);
  }
}

function currentTime(zone) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  } catch { return '—'; }
}

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
  $('teamCount').textContent = `${staff.length} ${staff.length === 1 ? 'person' : 'staff'}`;
  if (!staff.length) {
    addText(list, 'p', 'empty', 'No staff members yet. Add one on the right.');
    return;
  }
  for (const person of staff) {
    const card = document.createElement('article');
    card.className = 'staff-card';
    const top = addText(card, 'div', 'staff-top', '');
    const identity = addText(top, 'div', '', '');
    addText(identity, 'div', 'staff-name', person.name);
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
  $('discordId').value = person.discord_id;
  $('staffZone').value = person.time_zone;
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
    addText(box, 'strong', '', 'Add staff to see an overlap.');
    return;
  }
  if (data.windows.length) {
    const longest = [...data.windows].sort((a, b) => b.minutes - a.minutes)[0];
    addText(box, 'strong', '', `${longest.start} – ${longest.end}`);
    addText(box, 'p', '', `All ${data.total} staff members are likely available during this window in your time zone.`);
    if (data.recommended) addText(box, 'p', '', `Suggested 1-hour meeting: ${data.recommended.start} – ${oneHourLater(data.recommended.startUtc, $('viewerZone').value)}.`);
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
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

async function loadAvailability() {
  const date = $('meetingDate').value;
  const zone = $('viewerZone').value.trim();
  if (!date || !zone) return;
  try {
    const query = new URLSearchParams({ date, timeZone: zone });
    renderMeeting(await api(`/api/availability?${query}`));
    showError('panelError');
  } catch (error) { showError('panelError', error.message); }
}

async function loadPanel() {
  const data = await api('/api/staff');
  staff = data.staff;
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
    discordId: $('discordId').value,
    timeZone: $('staffZone').value,
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
$('viewerZone').addEventListener('change', loadAvailability);
setInterval(renderStaff, 60 * 1000);
fillTimeZones();
$('meetingDate').value = localDate();
$('viewerZone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
api('/api/me').then(data => {
  if (!data.authenticated) return showLogin();
  csrf = data.csrf;
  showPanel();
  loadPanel().catch(error => showError('panelError', error.message));
}).catch(error => {
  showLogin();
  showError('loginError', error.message);
});
