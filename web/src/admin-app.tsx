import { useEffect, useRef, useState, type FormEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, CalendarDays, Clock3, Database, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ZonePicker } from '@/components/zone-picker';
import { timeInZone } from '@/lib/converter';
import { defaultViewerZone, saveZoneCookie, validZone } from '@/lib/zones';

gsap.registerPlugin(useGSAP);

type Staff = {
  id: number; name: string; role: string; discord_id: string;
  time_zone: string; available_from: string; available_until: string;
};
type Window = { start: string; end: string; minutes: number; count: number };
type Availability = {
  total: number; windows: Window[];
  recommended: { start: string; startUtc: string } | null;
  bestPartial: Window | null;
};
type StaffForm = {
  name: string; role: string; discordId: string; timeZone: string;
  availableFrom: string; availableUntil: string;
};

const emptyForm: StaffForm = { name: '', role: '', discordId: '', timeZone: '', availableFrom: '13:00', availableUntil: '21:00' };
const filters = [
  ['all', 'All staff'], ['senior', 'All Senior ranks'], ['leadership', 'Heads, Directors & Overseers'],
  ['moderation', 'Moderation'], ['administration', 'Administration'], ['internal-affairs', 'Internal Affairs'],
  ['management', 'Management'], ['directorate', 'Directorate'], ['oversight', 'Overseer']
] as const;

function localDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

async function request<T>(url: string, csrf = '', options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options, credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(csrf && options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}

function MeetingResult({ data, totalStaff, zone }: { data: Availability | null; totalStaff: number; zone: string }) {
  if (!data) return <Skeleton className="h-28 w-full" />;
  if (!data.total) return <p className="py-8 text-sm text-muted-foreground">{totalStaff ? 'No staff in this group.' : 'Add staff to see a meeting window.'}</p>;
  if (!data.windows.length) return (
    <div className="flex flex-col gap-2 py-4">
      <p className="text-lg font-medium">No full-team overlap on this date.</p>
      <p className="text-sm text-muted-foreground">{data.bestPartial ? `Closest window: ${data.bestPartial.start} – ${data.bestPartial.end} (${data.bestPartial.count} of ${data.total} staff).` : 'Try another date or update usual hours.'}</p>
    </div>
  );
  const longest = [...data.windows].sort((a, b) => b.minutes - a.minutes)[0];
  return (
    <div className="flex flex-col gap-2 py-2" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Your team’s window</p>
      <strong className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{longest.start} – {longest.end}</strong>
      <p className="text-sm text-muted-foreground">All {data.total} selected staff members are likely available in {zone}.</p>
      {data.recommended && <Badge variant="secondary" className="mt-2 w-fit">Suggested 1-hour meeting · {data.recommended.start} – {timeInZone(new Date(Date.parse(data.recommended.startUtc) + 3600000), zone)}</Badge>}
      {data.windows.length > 1 && <p className="mt-2 text-xs text-muted-foreground">Other windows: {data.windows.map(window => `${window.start}–${window.end}`).join(' · ')}</p>}
    </div>
  );
}

export function AdminApp() {
  const root = useRef<HTMLElement>(null);
  const [auth, setAuth] = useState<'loading' | 'signed-out' | 'signed-in'>('loading');
  const [csrf, setCsrf] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [totalStaff, setTotalStaff] = useState(0);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [date, setDate] = useState(localDate);
  const [viewerZone, setViewerZone] = useState(defaultViewerZone);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [formVersion, setFormVersion] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [legacyRole, setLegacyRole] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-reveal]', { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.07, ease: 'power2.out', clearProps: 'all' });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [auth], revertOnUpdate: true });

  useEffect(() => {
    request<{ authenticated: boolean; csrf?: string }>('/api/me').then(data => {
      if (data.authenticated && data.csrf) { setCsrf(data.csrf); setAuth('signed-in'); }
      else setAuth('signed-out');
    }).catch(reason => { setError(reason.message); setAuth('signed-out'); });
    const clock = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (auth !== 'signed-in') return;
    request<{ roles: string[] }>('/api/roles').then(data => setRoles(data.roles)).catch(reason => setError(reason.message));
  }, [auth]);

  useEffect(() => {
    if (auth !== 'signed-in') return;
    let cancelled = false;
    request<{ staff: Staff[]; total: number }>(`/api/staff?group=${encodeURIComponent(filter)}`).then(data => {
      if (!cancelled) { setStaff(data.staff); setTotalStaff(data.total); }
    }).catch(reason => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [auth, filter, revision]);

  useEffect(() => {
    if (auth !== 'signed-in' || !date || !validZone(viewerZone)) return;
    let cancelled = false;
    setAvailability(null);
    const query = new URLSearchParams({ date, timeZone: viewerZone, group: filter });
    request<Availability>(`/api/availability?${query}`).then(data => {
      if (!cancelled) { setAvailability(data); saveZoneCookie(viewerZone); setError(''); }
    }).catch(reason => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [auth, date, viewerZone, filter, revision]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const data = await request<{ csrf: string }>('/api/login', '', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword(''); setCsrf(data.csrf); setAuth('signed-in');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign in.'); }
  }

  async function logout() {
    try { await request('/api/logout', csrf, { method: 'POST' }); } catch { /* Clear the local view as well. */ }
    setCsrf(''); setAuth('signed-out'); setStaff([]); setAvailability(null);
  }

  function resetForm() { setForm(emptyForm); setEditingId(null); setLegacyRole(''); setFormError(''); setFormVersion(value => value + 1); }

  function edit(person: Staff) {
    setEditingId(person.id);
    setLegacyRole(roles.includes(person.role) ? '' : person.role);
    setForm({ name: person.name, role: roles.includes(person.role) ? person.role : '', discordId: person.discord_id, timeZone: person.time_zone, availableFrom: person.available_from.slice(0, 5), availableUntil: person.available_until.slice(0, 5) });
    document.getElementById('staff-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!roles.includes(form.role)) return setFormError('Choose a role from the list.');
    if (!validZone(form.timeZone)) return setFormError('Choose a valid time zone.');
    if (form.availableFrom >= form.availableUntil) return setFormError('The end time must be later than the start time.');
    try {
      await request(editingId ? `/api/staff/${editingId}` : '/api/staff', csrf, {
        method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form)
      });
      resetForm(); setRevision(value => value + 1);
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Could not save this person.'); }
  }

  async function removePerson() {
    if (!deleteTarget) return;
    try {
      await request(`/api/staff/${deleteTarget.id}`, csrf, { method: 'DELETE' });
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null); setRevision(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove this person.'); }
  }

  return (
    <main ref={root} className="mx-auto min-h-svh w-full max-w-6xl px-5 pb-16 pt-7 sm:px-8 sm:pt-10">
      <header data-reveal className="flex items-center justify-between gap-4 border-b border-border pb-6">
        <a href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Clock3 size={18} /></span>VTime<span className="-ml-2 text-primary">.</span></a>
        <div className="flex items-center gap-3"><Badge variant="outline" className="hidden font-mono text-[10px] tracking-[0.12em] sm:inline-flex">PRIVATE STAFF PANEL</Badge>{auth === 'signed-in' && <Button variant="ghost" size="sm" onClick={logout}><LogOut data-icon="inline-start" /> Sign out</Button>}</div>
      </header>

      {auth === 'loading' ? <div className="mx-auto mt-24 max-w-sm"><Skeleton className="h-56 w-full" /></div> : auth === 'signed-out' ? (
        <div data-reveal className="mx-auto mt-20 w-full max-w-sm sm:mt-28">
          <Card><CardHeader><div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary"><Database size={20} /></div><CardTitle className="text-xl">Staff planner</CardTitle><CardDescription>Enter the password to manage your team and find a meeting time.</CardDescription></CardHeader>
            <CardContent><form onSubmit={login}><FieldGroup><Field><FieldLabel htmlFor="password">Password</FieldLabel><Input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></Field><Button type="submit" size="lg" className="w-full">Open panel</Button></FieldGroup></form>{error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}</CardContent></Card>
          <a href="/" className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to converter</a>
        </div>
      ) : (
        <>
          <div data-reveal className="mb-8 mt-9 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.17em] text-muted-foreground"><Users size={14} /> Team schedule</div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Staff planner</h1><p className="mt-2 text-sm text-muted-foreground">Find a time that works across your team’s usual hours.</p></div><Badge variant="secondary">{staff.length === totalStaff ? `${staff.length} staff` : `${staff.length} of ${totalStaff} staff`}</Badge></div>

          <Card data-reveal>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays size={17} /> Meeting overlap</CardTitle><CardDescription>Choose a date, your time zone, and the staff you want to include.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-5"><FieldGroup className="grid gap-4 md:grid-cols-3"><Field><FieldLabel htmlFor="meeting-date">Date</FieldLabel><Input id="meeting-date" type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field><FieldLabel htmlFor="viewer-zone">Your time zone</FieldLabel><ZonePicker id="viewer-zone" value={viewerZone} onChange={setViewerZone} /></Field><Field><FieldLabel htmlFor="staff-filter">Show staff</FieldLabel><NativeSelect id="staff-filter" className="w-full" value={filter} onChange={event => setFilter(event.target.value)}><NativeSelectOptGroup label="Rank groups">{filters.slice(0, 3).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelectOptGroup><NativeSelectOptGroup label="Departments">{filters.slice(3).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelectOptGroup></NativeSelect></Field></FieldGroup><Separator /><MeetingResult data={availability} totalStaff={totalStaff} zone={viewerZone} /><p className="text-xs text-muted-foreground">Estimates from saved hours, not live calendar events.</p></CardContent>
          </Card>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <Card data-reveal><CardHeader><CardTitle>Staff members</CardTitle><CardDescription>Local times and usual availability.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{staff.length ? staff.map(person => {
              const time = timeInZone(now, person.time_zone);
              const available = time >= person.available_from.slice(0, 5) && time < person.available_until.slice(0, 5);
              return <div key={person.id} className="rounded-lg border border-border bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-medium">{person.name}</div><p className="mt-0.5 text-xs text-muted-foreground">{person.role} · Discord {person.discord_id}</p></div><strong className="whitespace-nowrap font-mono text-lg tabular-nums">{time}</strong></div><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="outline">{person.time_zone}</Badge><Badge variant="outline">{person.available_from.slice(0, 5)}–{person.available_until.slice(0, 5)}</Badge><Badge variant={available ? 'secondary' : 'outline'}>{available ? 'Likely available' : 'Outside usual hours'}</Badge></div><div className="mt-3 flex gap-2 border-t border-border pt-3"><Button variant="ghost" size="sm" onClick={() => edit(person)}><Pencil data-icon="inline-start" /> Edit</Button><Button variant="ghost" size="sm" onClick={() => setDeleteTarget(person)}><Trash2 data-icon="inline-start" /> Remove</Button></div></div>;
            }) : <p className="py-8 text-center text-sm text-muted-foreground">{totalStaff ? 'No staff in this group.' : 'No staff members yet. Add one to get started.'}</p>}</CardContent></Card>

            <Card data-reveal id="staff-form"><CardHeader><CardTitle>{editingId ? 'Edit person' : 'Add a person'}</CardTitle><CardDescription>Set their rank, time zone, and usual hours.</CardDescription><CardAction><Plus size={17} className="text-muted-foreground" /></CardAction></CardHeader><CardContent><form onSubmit={savePerson}><FieldGroup><Field><FieldLabel htmlFor="staff-name">Name</FieldLabel><Input id="staff-name" maxLength={80} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Alex" required /></Field><Field><FieldLabel htmlFor="staff-role">Role</FieldLabel><NativeSelect id="staff-role" className="w-full" value={form.role} onChange={event => { setForm({ ...form, role: event.target.value }); setLegacyRole(''); }} required><NativeSelectOption value="" disabled>Select a role</NativeSelectOption>{roles.map(role => <NativeSelectOption key={role} value={role}>{role}</NativeSelectOption>)}</NativeSelect>{legacyRole && <FieldDescription>Previous role: {legacyRole}. Choose a current rank.</FieldDescription>}</Field><Field><FieldLabel htmlFor="discord-id">Discord ID</FieldLabel><Input id="discord-id" inputMode="numeric" pattern="[0-9]{17,20}" value={form.discordId} onChange={event => setForm({ ...form, discordId: event.target.value })} placeholder="17–20 digits" required /></Field><Field><FieldLabel htmlFor="staff-zone">Time zone</FieldLabel><ZonePicker key={`${editingId ?? 'new'}-${formVersion}`} id="staff-zone" value={form.timeZone} onChange={timeZone => setForm(current => ({ ...current, timeZone }))} required /><FieldDescription>Short zones stay fixed. Cities adjust for daylight saving.</FieldDescription></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="hours-from">Usually from</FieldLabel><Input id="hours-from" type="time" value={form.availableFrom} onChange={event => setForm({ ...form, availableFrom: event.target.value })} required /></Field><Field><FieldLabel htmlFor="hours-until">Until</FieldLabel><Input id="hours-until" type="time" value={form.availableUntil} onChange={event => setForm({ ...form, availableUntil: event.target.value })} required /></Field></div><div className="flex items-center gap-2"><Button type="submit" size="lg">{editingId ? 'Save changes' : 'Add staff member'}</Button>{editingId && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}</div></FieldGroup></form>{formError && <Alert variant="destructive" className="mt-4"><AlertDescription>{formError}</AlertDescription></Alert>}</CardContent></Card>
          </div>
          {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
        </>
      )}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle><AlertDialogDescription>This person will be removed from the staff list and meeting calculations.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removePerson}>Remove person</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
