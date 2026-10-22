import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeftRight, Check, Clock3, Copy, Database, Globe2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
    <main ref={root} className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 pb-24 pt-6 sm:px-8 sm:pt-8">
      <header data-reveal className="flex items-center justify-between border-b border-border pb-5">
        <a href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight" aria-label="VTime home">
          <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-foreground"><Clock3 size={17} /></span>
          VTime<span className="-ml-2">.</span>
        </a>
        <Badge variant="outline" className="text-xs font-normal">Time utility</Badge>
      </header>

      <section className="mx-auto w-full max-w-4xl py-10 sm:py-14" aria-labelledby="page-title">
        <div data-reveal className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Globe2 size={14} /> Across time zones</div>
          <h1 id="page-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Time zone converter</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find the right hour anywhere.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <Card data-reveal className="overflow-visible">
            <CardHeader>
              <CardTitle>Convert a time</CardTitle>
              <CardDescription>Choose a date, time, and two time zones.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="date">Date</FieldLabel><Input id="date" type="date" value={date} onChange={event => setDate(event.target.value)} required /></Field>
                <Field><FieldLabel htmlFor="time">Time</FieldLabel><Input id="time" type="time" value={time} onChange={event => setTime(event.target.value)} required /></Field>
              </FieldGroup>
              <Field><FieldLabel htmlFor="fromZone">From</FieldLabel><ZonePicker id="fromZone" value={fromZone} onChange={setFromZone} /></Field>
              <div className="-my-2 flex justify-center"><Button variant="outline" size="icon-sm" aria-label="Swap time zones" title="Swap time zones" onClick={swap}><ArrowLeftRight /></Button></div>
              <Field><FieldLabel htmlFor="toZone">To · your time zone</FieldLabel><ZonePicker id="toZone" value={toZone} onChange={changeTarget} /></Field>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">City zones adjust for daylight saving.</CardFooter>
          </Card>

          <Card data-reveal aria-live="polite">
            <CardHeader>
              <CardTitle>Converted time</CardTitle>
              <CardDescription>In {toZone || 'your time zone'}</CardDescription>
            </CardHeader>
            <CardContent ref={resultRef} className="flex min-h-44 flex-1 flex-col justify-center">
              <div className="text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">{result?.time || '—'}</div>
              <div className="mt-2 text-sm text-muted-foreground">{result?.date || 'Choose a valid date and time'}</div>
              {result && <p className="mt-5 text-xs text-muted-foreground">{fromZone} → {toZone} · {result.difference}{result.ambiguous ? ' · First occurrence of a repeated hour used.' : ''}</p>}
            </CardContent>
            <CardFooter><Button className="w-full" onClick={copy} disabled={!result}>{copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copied ? 'Copied' : 'Copy result'}</Button></CardFooter>
          </Card>
        </div>
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        <p data-reveal className="mt-5 text-center text-xs text-muted-foreground">Short zones and UTC offsets stay fixed.</p>
      </section>

      <a href="/admin" className="fixed bottom-5 right-5 z-10 flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label="Open staff planner" title="Staff planner"><Database size={18} /></a>
    </main>
  );
}
