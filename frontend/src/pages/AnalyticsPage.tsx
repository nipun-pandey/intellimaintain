import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Activity,
  Flame,
  Gauge,
  Zap,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { equipmentService } from '../services/equipment';
import { telemetryService, AggregatePointsResponse } from '../services/telemetry';
import { Equipment } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const AnalyticsPage: React.FC = () => {
  const { showToast } = useToast();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number>(1);
  const [period, setPeriod] = useState<string>('24h');
  const [aggregateData, setAggregateData] = useState<AggregatePointsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    if (selectedEquipmentId) {
      loadAnalytics();
    }
  }, [selectedEquipmentId, period]);

  const loadEquipment = async () => {
    try {
      const data = await equipmentService.list();
      setEquipmentList(data);
      if (data.length > 0) setSelectedEquipmentId(data[0].id);
    } catch {
      // ignore
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await telemetryService.getAggregated(selectedEquipmentId, period);
      setAggregateData(data);
    } catch {
      showToast('Error loading analytical telemetry aggregation', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const currentEquipment = equipmentList.find((e) => e.id === selectedEquipmentId);
  const points = aggregateData?.points || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono mb-1">
              Select Asset
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(Number(e.target.value))}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipment_code} — {eq.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 text-xs text-slate-500 font-mono">
            Location: <span className="text-slate-800 font-medium">{currentEquipment?.location}</span>
          </div>
        </div>

        {/* Aggregation Period */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
          {[
            { id: '1h', label: '1 Hour' },
            { id: '6h', label: '6 Hours' },
            { id: '24h', label: '24 Hours' },
            { id: '7d', label: '7 Days' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                period === tab.id ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Downsampling multi-channel telemetry points..." />
      ) : points.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No Aggregated Telemetry for this Asset"
          description="There are no telemetry points recorded within the selected aggregation timeframe."
        />
      ) : (
        <div className="space-y-6">
          {/* Chart 1: Average vs Peak Temperature & Anomaly Frequencies */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Thermal Headroom & Peak Envelope Analysis
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Mean Temp (°C) vs Max Peak Temp (°C) and Anomaly Frequency
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="bucket_time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis yAxisId="temp" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#ef4444' }} stroke="#fca5a5" />
                  <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10, fill: '#8b5cf6' }} stroke="#c4b5fd" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-600 font-mono">{value}</span>}
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="anomaly_count"
                    name="ML Anomalies"
                    fill="#a78bfa"
                    opacity={0.4}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="avg_temperature"
                    name="Mean Temp (°C)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="max_temperature"
                    name="Peak Temp (°C)"
                    stroke="#b91c1c"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: RMS Vibration Velocity vs Mechanical Load */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Vibration Severity (ISO 10816) & Electrical Load
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  RMS Vibration Velocity (mm/s) vs Motor Phase Current (A)
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="bucket_time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis yAxisId="vib" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#3b82f6' }} stroke="#93c5fd" />
                  <YAxis yAxisId="curr" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#f59e0b' }} stroke="#fcd34d" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-600 font-mono">{value}</span>}
                  />
                  <Line
                    yAxisId="vib"
                    type="monotone"
                    dataKey="avg_vibration"
                    name="Mean Vibration (mm/s)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="vib"
                    type="monotone"
                    dataKey="max_vibration"
                    name="Peak Vibration (mm/s)"
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    yAxisId="curr"
                    type="monotone"
                    dataKey="avg_current"
                    name="Motor Current (A)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
