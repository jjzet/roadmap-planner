import type { ReactNode } from 'react';

type Variant = 'danger' | 'warning' | 'success' | 'info' | 'neutral';

const VARIANT_STYLES: Record<Variant, string> = {
  danger:  'bg-blue-100 border-blue-300 text-blue-800',
  warning: 'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-blue-50 border-blue-200 text-blue-700',
  info:    'bg-blue-50 border-blue-200 text-blue-600',
  neutral: 'bg-blue-50/60 border-blue-100 text-blue-600',
};

interface StatBadgeProps {
  label: string;
  value: number;
  variant?: Variant;
  icon?: ReactNode;
}

export function StatBadge({ label, value, variant = 'neutral', icon }: StatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono tabular-nums leading-none ${VARIANT_STYLES[variant]}`}
    >
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="opacity-70 font-normal">{label}</span>
    </span>
  );
}
