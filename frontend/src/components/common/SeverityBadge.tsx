import React from 'react';

interface SeverityBadgeProps {
  severity: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const norm = severity?.toLowerCase() || 'low';

  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  switch (norm) {
    case 'critical':
      color = 'bg-rose-100 text-rose-800 border-rose-300';
      break;
    case 'high':
      color = 'bg-orange-100 text-orange-800 border-orange-300';
      break;
    case 'medium':
      color = 'bg-amber-100 text-amber-800 border-amber-300';
      break;
    case 'low':
      color = 'bg-blue-100 text-blue-800 border-blue-300';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase border ${color}`}>
      {severity}
    </span>
  );
};
