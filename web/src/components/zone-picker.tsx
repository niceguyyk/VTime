import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { cityZones, shortZones } from '@/lib/zones';

const listed = new Set([...shortZones.map(([value]) => value), ...cityZones]);

export function ZonePicker({ id, value, onChange, required = false }: {
  id: string;
  value: string;
  onChange: (zone: string) => void;
  required?: boolean;
}) {
  const [custom, setCustom] = useState(Boolean(value) && !listed.has(value));
  useEffect(() => {
    if (listed.has(value)) setCustom(false);
    else if (value) setCustom(true);
  }, [value]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <NativeSelect
        id={id}
        className="w-full"
        value={custom ? '__custom__' : value}
        onChange={event => {
          if (event.target.value === '__custom__') { setCustom(true); onChange(''); }
          else { setCustom(false); onChange(event.target.value); }
        }}
        required={required && !custom}
      >
        <NativeSelectOption value="" disabled>Select a time zone</NativeSelectOption>
        <NativeSelectOptGroup label="Short time zones & UTC offsets · fixed">
          {shortZones.map(([zone, label]) => <NativeSelectOption key={zone} value={zone}>{label}</NativeSelectOption>)}
        </NativeSelectOptGroup>
        <NativeSelectOptGroup label="City time zones · daylight saving aware">
          {cityZones.map(zone => <NativeSelectOption key={zone} value={zone}>{zone}</NativeSelectOption>)}
        </NativeSelectOptGroup>
        <NativeSelectOption value="__custom__">Custom time zone…</NativeSelectOption>
      </NativeSelect>
      {custom && <Input aria-label="Custom time zone" placeholder="e.g. UTC+5:45" value={value} onChange={event => onChange(event.target.value)} required={required} />}
    </div>
  );
}
