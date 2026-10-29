import React from 'react';
import { Play, Square, Activity, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SimulatorStatus } from '../../types';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  simulatorStatus?: SimulatorStatus | null;
  onOpenSimulator?: () => void;
  onStopSimulator?: () => void;
  activeAlertsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  simulatorStatus,
  onOpenSimulator,
  onStopSimulator,
  activeAlertsCount = 0,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Backend Connectivity Mode Pill */}
        {import.meta.env.VITE_API_URL ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Connected to ${import.meta.env.VITE_API_URL}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live API</span>
          </div>
        ) : (
          <Link
            to="/settings"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
            title="Running in Standalone Demo Mode. Set VITE_API_URL in Vercel to connect live backend."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Demo Mode</span>
          </Link>
        )}

        {/* Simulator Control Quick-Pill */}
        {simulatorStatus?.is_running ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="font-mono font-medium">
              Sim: {simulatorStatus.equipment_code} ({simulatorStatus.scenario})
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-slate-600">#{simulatorStatus.readings_generated}</span>
            {onStopSimulator && (
              <button
                onClick={onStopSimulator}
                className="ml-1 p-1 hover:bg-blue-100 rounded text-rose-600 transition-colors"
                title="Halt active simulation"
              >
                <Square className="w-3.5 h-3.5 fill-rose-600" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-blue-600" />
            <span>Launch Simulator</span>
          </button>
        )}

        {/* Active Alarms Notification shortcut */}
        <Link
          to="/alerts"
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Active Alerts"
        >
          <Bell className="w-4 h-4" />
          {activeAlertsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </Link>
      </div>
    </header>
  );
};
