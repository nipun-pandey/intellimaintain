import React, { useState, useEffect } from 'react';
import {
  Activity,
  Flame,
  Gauge,
  Zap,
  RotateCcw,
  Play,
  Square,
  Radio,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { equipmentService } from '../services/equipment';
import { telemetryService } from '../services/telemetry';
import { simulatorService } from '../services/simulator';
import { Equipment, Telemetry, SimulatorStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

export const LiveMonitoringPage: React.FC = () => {
  const { showToast } = useToast();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number>(1);
  const [telemetryStream, setTelemetryStream] = useState<Telemetry[]>([]);
  const [pollInterval, setPollInterval] = useState<number>(2000);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    if (selectedEquipmentId) {
      fetchLatestTelemetry();
    }
  }, [selectedEquipmentId]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      fetchLatestTelemetry();
      fetchSimStatus();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [selectedEquipmentId, pollInterval, isPaused]);

  const loadEquipment = async () => {
    setIsLoading(true);
    try {
      const data = await equipmentService.list();
      setEquipmentList(data);
      if (data.length > 0) setSelectedEquipmentId(data[0].id);
    } catch {
      showToast('Error connecting to telemetry service', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLatestTelemetry = async () => {
    try {
      const recent = await telemetryService.getRecent(selectedEquipmentId, 30);
      setTelemetryStream(recent);
    } catch {
      // offline or server restarting
    }
  };

  const fetchSimStatus = async () => {
    try {
      const s = await simulatorService.getStatus();
      setSimStatus(s);
    } catch {
      // ignore
    }
  };

  const currentEquipment = equipmentList.find((e) => e.id === selectedEquipmentId);
  const latest = telemetryStream[telemetryStream.length - 1];

  const handleStartSim = async (scenario: string) => {
    try {
      const s = await simulatorService.start(selectedEquipmentId, scenario, 1.5);
      setSimStatus(s);
      showToast(`Simulation started: ${scenario}`, 'success');
    } catch {
      showToast('Error starting simulator', 'error');
    }
  };

  const handleStopSim = async () => {
    try {
      const s = await simulatorService.stop();
      setSimStatus(s);
      showToast('Simulator stopped', 'info');
    } catch {
      showToast('Error stopping simulator', 'error');
    }
  };

  if (isLoading || !currentEquipment) {
    return <LoadingSpinner message="Initializing live telemetry feed..." />;
  }

  const chartData = telemetryStream.map((t) => ({
    time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temperature: t.temperature,
    vibration: t.vibration,
    pressure: t.pressure,
    motor_current: t.motor_current,
    speed_rpm: t.speed_rpm,
    is_anomaly: t.is_anomaly,
  }));

  const th = currentEquipment.sensor_thresholds || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Asset Selector & Live Status Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono mb-1">
              Select Monitored Asset
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(Number(e.target.value))}
              className="text-sm font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipment_code} — {eq.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center gap-2">
            <StatusBadge status={currentEquipment.operational_status} />
            <span className="text-xs text-slate-400 font-mono">Location: {currentEquipment.location}</span>
          </div>
        </div>

        {/* Polling & Simulator Quick Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span>{isPaused ? 'STREAM PAUSED' : 'LIVE 2.0s'}</span>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition-colors"
          >
            {isPaused ? 'Resume Stream' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Real-time Industrial Parameter Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Temperature Card */}
        <div className={`p-5 rounded-xl border bg-white shadow-sm transition-all ${
          latest && latest.temperature >= (th.temp_crit || 90)
            ? 'border-rose-400 bg-rose-50/30'
            : latest && latest.temperature >= (th.temp_warn || 75)
            ? 'border-amber-400 bg-amber-50/30'
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span className="uppercase font-semibold tracking-wider">Bearing Temp</span>
            <Flame className={`w-4 h-4 ${latest && latest.temperature >= (th.temp_warn || 75) ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {latest ? latest.temperature.toFixed(1) : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500">°C</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Warn: {th.temp_warn || 75}°C | Crit: {th.temp_crit || 90}°C
          </div>
        </div>

        {/* Vibration Card */}
        <div className={`p-5 rounded-xl border bg-white shadow-sm transition-all ${
          latest && latest.vibration >= (th.vib_crit || 7.1)
            ? 'border-rose-400 bg-rose-50/30'
            : latest && latest.vibration >= (th.vib_warn || 4.5)
            ? 'border-amber-400 bg-amber-50/30'
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span className="uppercase font-semibold tracking-wider">Vibration RMS</span>
            <Activity className={`w-4 h-4 ${latest && latest.vibration >= (th.vib_warn || 4.5) ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {latest ? latest.vibration.toFixed(2) : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500">mm/s</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            ISO 10816 Zone D: {th.vib_crit || 7.1} mm/s
          </div>
        </div>

        {/* Pressure Card */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span className="uppercase font-semibold tracking-wider">Discharge Press</span>
            <Gauge className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {latest ? latest.pressure.toFixed(2) : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500">bar</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Envelope: [{th.press_min || 1.5} - {th.press_max || 6.0}] bar
          </div>
        </div>

        {/* Motor Current Card */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span className="uppercase font-semibold tracking-wider">Motor Phase Draw</span>
            <Zap className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {latest ? latest.motor_current.toFixed(1) : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-500">A</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Full Load Rating: {th.current_max || 35.0} A
          </div>
        </div>
      </div>

      {/* Live Oscilloscope-Style Charts */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Real-Time Oscilloscope: {currentEquipment.equipment_code}
            </h3>
            <p className="text-xs text-slate-500 font-mono">Synchronized Temperature (°C) & Vibration (mm/s RMS)</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-slate-600">Temp</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-slate-600">Vibration</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
              <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#ef4444' }} stroke="#fca5a5" />
              <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#3b82f6' }} stroke="#93c5fd" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '11px',
                  color: '#fff',
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                name="Temperature (°C)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="vibration"
                name="Vibration (mm/s)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Simulator Scenario Injection Dock */}
      <div className="bg-slate-900 rounded-xl p-6 text-white border border-slate-800 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              <span>Simulated Scenario Telemetry Injector</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Inject hardware degradation scenarios directly through the backend ingestion pipeline
            </p>
          </div>

          {simStatus?.is_running && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded">
                Simulating: {simStatus.scenario} (#{simStatus.readings_generated})
              </span>
              <button
                onClick={handleStopSim}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
              >
                Halt
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => handleStartSim('normal')}
            className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors"
          >
            <div className="text-xs font-semibold text-white">1. Normal Run</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Plausible design baseline</div>
          </button>

          <button
            onClick={() => handleStartSim('deterioration')}
            className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors"
          >
            <div className="text-xs font-semibold text-amber-400">2. Bearing Wear</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Ramps vibration & temp</div>
          </button>

          <button
            onClick={() => handleStartSim('anomaly')}
            className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors"
          >
            <div className="text-xs font-semibold text-rose-400">3. Sudden Spike</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Severe shock anomaly</div>
          </button>

          <button
            onClick={() => handleStartSim('communication_interruption')}
            className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors"
          >
            <div className="text-xs font-semibold text-purple-400">4. Stale Signal</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Simulate network drop</div>
          </button>
        </div>
      </div>
    </div>
  );
};
