import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeftRight, Check, Clock3, Copy, Database, Globe2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ZonePicker } from '@/components/zone-picker';
import { convert } from '@/lib/converter';
import { defaultViewerZone, saveZoneCookie, validZone } from '@/lib/zones';

gsap.registerPlugin(useGSAP);

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function ConverterApp() {
  const root = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(localDate);
  const [time, setTime] = useState('01:00');
  const [fromZone, setFromZone] = useState('EDT');
  const [toZone, setToZone] = useState(defaultViewerZone);
  const [copied, setCopied] = useState(false);

  const { result, error } = useMemo(() => {
    if (!validZone(fromZone) || !validZone(toZone)) return { result: null, error: 'Choose valid time zones.' };
    try { return { result: convert(date, time, fromZone, toZone), error: '' }; }
    catch (reason) { return { result: null, error: reason instanceof Error ? reason.message : 'Could not convert this time.' }; }
  }, [date, time, fromZone, toZone]);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-reveal]', { autoAlpha: 0, y: 18, duration: 0.65, stagger: 0.1, ease: 'power3.out', clearProps: 'all' });
    });
    return () => mm.revert();
  }, { scope: root });

  useGSAP(() => {
    if (!resultRef.current || !result || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(resultRef.current, { opacity: 0.55, y: 7 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', overwrite: true });
  }, { dependencies: [result?.time, result?.date], scope: root, revertOnUpdate: true });

  function changeTarget(zone: string) {
    setToZone(zone);
    if (validZone(zone)) saveZoneCookie(zone);
  }

  function swap() {
    const nextFrom = toZone;
    const nextTo = fromZone;
    if (result) {
      const p = result.targetParts;
      setDate(`${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`);
      setTime(`${String(p[3]).padStart(2, '0')}:${String(p[4]).padStart(2, '0')}`);
    }
    setFromZone(nextFrom);
    changeTarget(nextTo);
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${result.time} · ${result.date} (${toZone})`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  return (
    <main ref={root} className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-5 pb-24 pt-7 sm:px-8 sm:pt-10">
      <header data-reveal className="flex items-center justify-between border-b border-border pb-6">
        <a href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight" aria-label="VTime home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Clock3 size={18} /></span>
          VTime<span className="-ml-2 text-primary">.</span>
        </a>
        <Badge variant="outline" className="font-mono text-[10px] tracking-[0.16em]">TIME UTILITY</Badge>
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10 sm:py-12" aria-labelledby="page-title">
        <div data-reveal className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"><Globe2 size={14} /> Across time zones</div>
          <h1 id="page-title" className="text-4xl font-semibold tracking-tight sm:text-5xl">Time, translated.</h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">Find the right hour anywhere. Fixed offsets and daylight saving aware cities, together in one place.</p>
        </div>

        <Card data-reveal className="overflow-visible">
          <CardHeader className="border-b border-border pb-5">
            <CardTitle className="text-base">Time zone converter</CardTitle>
            <CardDescription>Enter a time, then choose where it starts and where it lands.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-5">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="date">Date</FieldLabel><Input id="date" type="date" value={date} onChange={event => setDate(event.target.value)} required /></Field>
              <Field><FieldLabel htmlFor="time">Time</FieldLabel><Input id="time" type="time" value={time} onChange={event => setTime(event.target.value)} required /></Field>
            </FieldGroup>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <Field><FieldLabel htmlFor="fromZone">From</FieldLabel><ZonePicker id="fromZone" value={fromZone} onChange={setFromZone} /></Field>
              <Button variant="outline" size="icon" aria-label="Swap time zones" title="Swap time zones" onClick={swap} className="mb-0.5 justify-self-center"><ArrowLeftRight /></Button>
              <Field><FieldLabel htmlFor="toZone">To · your time zone</FieldLabel><ZonePicker id="toZone" value={toZone} onChange={changeTarget} /></Field>
            </div>
          </CardContent>
        </Card>

        <Card data-reveal className="mt-4 border-primary/20 bg-primary/5" aria-live="polite">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div><CardDescription className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em]">Converted time</CardDescription><CardTitle>In {toZone || 'your time zone'}</CardTitle></div>
            <Button variant="outline" size="icon" aria-label={copied ? 'Copied' : 'Copy result'} title="Copy result" onClick={copy} disabled={!result}>{copied ? <Check /> : <Copy />}</Button>
          </CardHeader>
          <CardContent ref={resultRef}>
            <div className="text-5xl font-semibold tabular-nums tracking-tighter sm:text-6xl">{result?.time || '—'}</div>
            <div className="mt-1 text-sm text-muted-foreground">{result?.date || 'Choose a valid date and time'}</div>
            {result && <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">{fromZone} → {toZone} · {result.difference}{result.ambiguous ? ' · First occurrence of a repeated hour used.' : ''}</p>}
          </CardContent>
        </Card>
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        <p data-reveal className="mt-5 text-center text-xs text-muted-foreground">City zones adjust for daylight saving. Short zones and UTC offsets stay fixed.</p>
      </section>

      <a href="/admin" className="fixed bottom-5 right-5 z-10 flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label="Open staff planner" title="Staff planner"><Database size={19} /></a>
    </main>
  );
}
