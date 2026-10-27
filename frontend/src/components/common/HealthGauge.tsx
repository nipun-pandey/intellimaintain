import React from 'react';

interface HealthGaugeProps {
  score?: number;
  category?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({ score = 100, category = 'Good', size = 'md' }) => {
  let strokeColor = '#10b981'; // green
  let textColor = 'text-emerald-700';
  let bgColor = 'bg-emerald-50';

  if (category.includes('Stale') || category.includes('No Data')) {
    strokeColor = '#94a3b8';
    textColor = 'text-slate-600';
    bgColor = 'bg-slate-50';
  } else if (score < 40) {
    strokeColor = '#ef4444'; // red
    textColor = 'text-rose-700';
    bgColor = 'bg-rose-50';
  } else if (score < 65) {
    strokeColor = '#f59e0b'; // amber
    textColor = 'text-amber-700';
    bgColor = 'bg-amber-50';
  } else if (score < 85) {
    strokeColor = '#3b82f6'; // blue
    textColor = 'text-blue-700';
    bgColor = 'bg-blue-50';
  }

  const radius = size === 'lg' ? 44 : size === 'sm' ? 22 : 32;
  const strokeWidth = size === 'lg' ? 8 : size === 'sm' ? 4 : 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;

  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex items-center justify-center">
        <svg width={svgSize} height={svgSize} className="transform -rotate-90">
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono font-bold ${textColor} ${size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-xs' : 'text-sm'}`}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {size !== 'sm' && (
        <div className="flex flex-col">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border inline-block w-fit ${bgColor} ${textColor}`}>
            {category}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-mono">Health Index</span>
        </div>
      )}
    </div>
  );
};
