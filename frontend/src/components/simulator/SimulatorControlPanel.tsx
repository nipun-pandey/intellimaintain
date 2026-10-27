import React, { useState, useEffect } from 'react';
import { Play, Square, RotateCcw, Activity, ShieldAlert, Cpu } from 'lucide-react';
import { simulatorService } from '../../services/simulator';
import { equipmentService } from '../../services/equipment';
import { Equipment, SimulatorStatus } from '../../types';
import { useToast } from '../../context/ToastContext';

interface SimulatorControlPanelProps {
  onStatusChange?: (status: SimulatorStatus) => void;
}

export const SimulatorControlPanel: React.FC<SimulatorControlPanelProps> = ({ onStatusChange }) => {
  const { showToast } = useToast();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number>(1);
  const [scenario, setScenario] = useState<string>('normal');
  const [intervalSeconds, setIntervalSeconds] = useState<number>(2.0);
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [recentReadings, setRecentReadings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    loadEquipment();
    refreshStatus();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status?.is_running) {
      timer = setInterval(() => {
        refreshStatus();
        fetchRecentReadings();
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [status?.is_running]);

  const loadEquipment = async () => {
    try {
      const data = await equipmentService.list();
      setEquipmentList(data);
      if (data.length > 0 && !selectedEquipmentId) {
        setSelectedEquipmentId(data[0].id);
      }
    } catch {
      // fallback
    }
  };

  const refreshStatus = async () => {
    try {
      const s = await simulatorService.getStatus();
      setStatus(s);
      if (onStatusChange) onStatusChange(s);
    } catch {
      // ignore
    }
  };

  const fetchRecentReadings = async () => {
    try {
      const readings = await simulatorService.getRecentReadings();
      setRecentReadings(readings);
    } catch {
      // ignore
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const s = await simulatorService.start(selectedEquipmentId, scenario, intervalSeconds);
      setStatus(s);
      if (onStatusChange) onStatusChange(s);
      showToast(`Telemetry simulator launched (${scenario} scenario)`, 'success');
      fetchRecentReadings();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to start simulator', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const s = await simulatorService.stop();
      setStatus(s);
      if (onStatusChange) onStatusChange(s);
      showToast('Simulator halted', 'info');
    } catch {
      showToast('Error stopping simulator', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      const s = await simulatorService.reset();
      setStatus(s);
      setRecentReadings([]);
      if (onStatusChange) onStatusChange(s);
      showToast('Simulator state reset', 'info');
    } catch {
      showToast('Error resetting simulator', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Equipment Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1.5">
            Target Equipment
          </label>
          <select
            value={selectedEquipmentId}
            onChange={(e) => setSelectedEquipmentId(Number(e.target.value))}
            disabled={status?.is_running}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            {equipmentList.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.equipment_code} — {eq.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scenario Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1.5">
            Simulation Scenario
          </label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            disabled={status?.is_running}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="normal">1. Normal Operation (Stable Baseline)</option>
            <option value="deterioration">2. Gradual Deterioration (Ramping Wear)</option>
            <option value="anomaly">3. Sudden Anomaly (Severe Outlier Spike)</option>
            <option value="sensor_failure">4. Sensor Failure (Stuck / Bad Signal)</option>
            <option value="communication_interruption">5. Communication Interruption (Stale Telemetry)</option>
          </select>
        </div>

        {/* Interval Control */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1.5">
            Ingestion Interval: <span className="font-mono text-blue-600 font-bold">{intervalSeconds}s</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="10.0"
            step="0.5"
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            disabled={status?.is_running}
            className="w-full accent-blue-600 disabled:opacity-60 mt-2"
          />
        </div>
      </div>

      {/* Scenario Descriptions Card */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
        <span className="font-semibold text-slate-800">Scenario Logic: </span>
        {scenario === 'normal' && 'Generates stable, plausible temperature, vibration, pressure, current, and RPM values within nominal design limits.'}
        {scenario === 'deterioration' && 'Progressively amplifies vibration from 2.2 mm/s to 8.5 mm/s and temperature over 30 steps to simulate bearing wear.'}
        {scenario === 'anomaly' && 'Simulates an immediate thermal and mechanical shock spike past ISO Zone D threshold after step 3.'}
        {scenario === 'sensor_failure' && 'Simulates frozen/stuck physical sensor values and marks signal status as bad.'}
        {scenario === 'communication_interruption' && 'Sends one reading then withholds further transmission to verify stale telemetry alarms.'}
      </div>

      {/* Action Buttons & Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {!status?.is_running ? (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Simulator</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Stop Simulator</span>
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={isLoading || status?.is_running}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>

        {/* Live Status readout */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">State:</span>
            <span className={`font-semibold ${status?.is_running ? 'text-emerald-600' : 'text-slate-600'}`}>
              {status?.status_message || 'Idle'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Readings:</span>
            <span className="font-semibold text-slate-800">{status?.readings_generated || 0}</span>
          </div>
        </div>
      </div>

      {/* Real-time Streaming Table */}
      {recentReadings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
              Live Ingested Telemetry Feed (Real Backend Data)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Auto-refreshed via API</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Temp (°C)</th>
                  <th className="py-2 px-3">Vib (mm/s)</th>
                  <th className="py-2 px-3">Press (bar)</th>
                  <th className="py-2 px-3">Current (A)</th>
                  <th className="py-2 px-3">ML Anomaly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentReadings.slice().reverse().map((r, i) => (
                  <tr key={i} className={r.is_anomaly ? 'bg-rose-50/60 font-semibold text-rose-900' : 'text-slate-700'}>
                    <td className="py-1.5 px-3 text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td className="py-1.5 px-3">{r.temperature}°C</td>
                    <td className="py-1.5 px-3">{r.vibration}</td>
                    <td className="py-1.5 px-3">{r.pressure}</td>
                    <td className="py-1.5 px-3">{r.motor_current}</td>
                    <td className="py-1.5 px-3">
                      {r.is_anomaly ? (
                        <span className="text-rose-600 font-bold">YES ({r.anomaly_score})</span>
                      ) : (
                        <span className="text-emerald-600">No ({r.anomaly_score})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
