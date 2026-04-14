import type { ReactNode } from 'react';

type Variant = 'danger' | 'warning' | 'success' | 'info' | 'neutral';

const VARIANT_STYLES: Record<Variant, string> = {
  danger:  'bg-red-50 border-red-200 text-red-600',
  warning: 'bg-orange-50 border-orange-200 text-orange-600',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  info:    'bg-cyan-50 border-cyan-200 text-cyan-600',
  neutral: 'bg-gray-50 border-gray-200 text-gray-500',
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
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono tabular-nums leading-none ${VARIANT_STYLES[variant]}`}
    >
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="opacity-70 font-normal">{label}</span>
    </span>
  );
}
