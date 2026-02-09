import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

const options = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find((o) => o.value === theme) ?? options[2];
  const Icon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
        title={`Theme: ${current.label}`}
        aria-label="Toggle theme"
        onClick={() => setOpen(!open)}
      >
        <Icon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-36 rounded-xl border bg-popover p-1 shadow-elevated animate-fade-in">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Theme</div>
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-accent',
                  option.value === theme && 'bg-accent font-medium',
                )}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
              >
                <OptionIcon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
