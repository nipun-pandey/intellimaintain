import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'critical' | 'warning' | 'success';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}) => {
  let iconBg = 'bg-blue-50 text-blue-600';
  let borderHighlight = 'border-slate-200';

  if (variant === 'critical') {
    iconBg = 'bg-rose-50 text-rose-600';
    borderHighlight = 'border-rose-200/80';
  } else if (variant === 'warning') {
    iconBg = 'bg-amber-50 text-amber-600';
    borderHighlight = 'border-amber-200/80';
  } else if (variant === 'success') {
    iconBg = 'bg-emerald-50 text-emerald-600';
    borderHighlight = 'border-emerald-200/80';
  }

  return (
    <div className={`bg-white rounded-xl p-5 border shadow-sm transition-all hover:shadow ${borderHighlight}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
          {value}
        </span>
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-1">{subtitle}</p>
      )}
    </div>
  );
};
