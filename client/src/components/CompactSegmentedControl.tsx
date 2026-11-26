type CompactSegmentedControlProps<Value extends string> = {
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value | null;
  onChange: (value: Value) => void;
};

export function CompactSegmentedControl<Value extends string>({ label, options, value, onChange }: CompactSegmentedControlProps<Value>) {
  return (
    <div className="inline-flex max-w-full rounded-full bg-slate-900/70 p-0.5 ring-1 ring-white/10" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className="h-7 min-w-16 cursor-pointer whitespace-nowrap rounded-full px-3 text-xs font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300 aria-pressed:bg-slate-700 aria-pressed:text-white"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
