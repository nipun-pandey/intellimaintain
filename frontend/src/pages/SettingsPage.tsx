import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Cpu,
  Database,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { simulatorService } from '../services/simulator';
import { analyticsService } from '../services/analytics';
import { SimulatorStatus } from '../types';
import { SimulatorControlPanel } from '../components/simulator/SimulatorControlPanel';
import { useToast } from '../context/ToastContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDemoData = async () => {
    setIsSeeding(true);
    try {
      await analyticsService.seedDemoData();
      showToast('Database demo data successfully reseeded', 'success');
    } catch {
      showToast('Failed to seed demo data', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Account Profile Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold uppercase shadow-md">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{user?.full_name}</h3>
            <p className="text-xs text-slate-500 font-mono">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                Role: {user?.role}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                Active Session
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Controls Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Industrial Telemetry Simulator Panel</span>
          </h3>
          <p className="text-xs text-slate-500 font-mono">
            Execute virtual sensor simulation scenarios to validate telemetry ingestion and alarm logic
          </p>
        </div>
        <SimulatorControlPanel />
      </div>

      {/* Database Seeding & Environment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment Status */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Runtime Environment</span>
          </h3>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">API Gateway:</span>
              <span className="text-emerald-700 font-bold">FastAPI v0.111.1 (Online)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Database Engine:</span>
              <span className="text-slate-800 font-bold">PostgreSQL / SQLite Compatible</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">ML Model:</span>
              <span className="text-purple-700 font-bold">Isolation Forest (100 Trees, Contam=0.08)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Vibration Standard:</span>
              <span className="text-slate-800 font-bold">ISO 10816 Zone D Limits</span>
            </div>
          </div>
        </div>

        {/* Demo Data Reset */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600" />
              <span>Reset & Seed Demonstration Data</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Populates 6 industrial assets (Centrifugal Pump, Compressor, Extruder Motor, Cooling Tower Fan, Hydraulic Press, Turbine) along with 48 hours of telemetry, active alarms, and work orders.
            </p>
          </div>

          <button
            onClick={handleSeedDemoData}
            disabled={isSeeding}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold font-mono transition-colors disabled:opacity-50"
          >
            {isSeeding ? 'Populating Database...' : 'Re-Populate Seed Data'}
          </button>
        </div>
      </div>

      {/* Demo Credentials Reference */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-white space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-300">
            Development Role Credentials
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 space-y-1">
            <span className="text-purple-400 font-bold">Admin (Full Control)</span>
            <p className="text-slate-300 text-[11px]">admin@intellimaintain.io</p>
            <p className="text-slate-400 text-[10px]">Pass: AdminPass123!</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 space-y-1">
            <span className="text-blue-400 font-bold">Engineer (Ops & Actions)</span>
            <p className="text-slate-300 text-[11px]">engineer@intellimaintain.io</p>
            <p className="text-slate-400 text-[10px]">Pass: EngineerPass123!</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 space-y-1">
            <span className="text-emerald-400 font-bold">Viewer (Read Only)</span>
            <p className="text-slate-300 text-[11px]">viewer@intellimaintain.io</p>
            <p className="text-slate-400 text-[10px]">Pass: ViewerPass123!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
