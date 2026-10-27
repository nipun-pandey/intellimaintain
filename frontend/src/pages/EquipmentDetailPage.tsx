import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Cpu,
  Activity,
  AlertTriangle,
  Wrench,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Plus,
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
import { alertService } from '../services/alerts';
import { maintenanceService } from '../services/maintenance';
import api from '../services/api';
import { Equipment, Telemetry, Alert, MaintenanceRecord, HealthAssessment } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { HealthGauge } from '../components/common/HealthGauge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const EquipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const equipmentId = Number(id);
  const { isEngineer } = useAuth();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [health, setHealth] = useState<HealthAssessment | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<Telemetry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Maintenance Modal
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintType, setMaintType] = useState('preventive');
  const [maintPriority, setMaintPriority] = useState('medium');
  const [maintDate, setMaintDate] = useState('');
  const [maintTech, setMaintTech] = useState('');
  const [maintDesc, setMaintDesc] = useState('');

  // Resolve Alert Modal
  const [resolveAlertId, setResolveAlertId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    if (equipmentId) {
      loadAllData();
      const interval = setInterval(loadTelemetryAndHealth, 5000);
      return () => clearInterval(interval);
    }
  }, [equipmentId]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [eq, h, tel, al, maint] = await Promise.all([
        equipmentService.get(equipmentId),
        api.get<HealthAssessment>(`/api/v1/health/equipment/${equipmentId}`).then((r) => r.data),
        telemetryService.getRecent(equipmentId, 40),
        alertService.list({ equipment_id: equipmentId }),
        maintenanceService.list({ equipment_id: equipmentId }),
      ]);
      setEquipment(eq);
      setHealth(h);
      setTelemetryHistory(tel);
      setAlerts(al);
      setMaintenanceRecords(maint);
    } catch {
      showToast('Error loading asset profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTelemetryAndHealth = async () => {
    try {
      const [h, tel, al] = await Promise.all([
        api.get<HealthAssessment>(`/api/v1/health/equipment/${equipmentId}`).then((r) => r.data),
        telemetryService.getRecent(equipmentId, 40),
        alertService.list({ equipment_id: equipmentId }),
      ]);
      setHealth(h);
      setTelemetryHistory(tel);
      setAlerts(al);
    } catch {
      // ignore
    }
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await alertService.acknowledge(alertId);
      showToast('Alert acknowledged', 'success');
      loadTelemetryAndHealth();
    } catch {
      showToast('Failed to acknowledge alert', 'error');
    }
  };

  const handleResolveAlert = async () => {
    if (!resolveAlertId || !resolutionNotes.trim()) {
      showToast('Please specify resolution notes', 'warning');
      return;
    }
    try {
      await alertService.resolve(resolveAlertId, resolutionNotes);
      showToast('Alert resolved and equipment operational state updated', 'success');
      setResolveAlertId(null);
      setResolutionNotes('');
      loadAllData();
    } catch {
      showToast('Failed to resolve alert', 'error');
    }
  };

  const handleScheduleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTitle || !maintDate) {
      showToast('Please provide a title and scheduled date', 'warning');
      return;
    }
    try {
      await maintenanceService.create({
        equipment_id: equipmentId,
        title: maintTitle,
        maintenance_type: maintType as any,
        priority: maintPriority as any,
        scheduled_date: new Date(maintDate).toISOString(),
        assigned_technician: maintTech,
        description: maintDesc,
      });
      showToast('Maintenance work order scheduled', 'success');
      setIsMaintModalOpen(false);
      setMaintTitle('');
      setMaintDesc('');
      const updated = await maintenanceService.list({ equipment_id: equipmentId });
      setMaintenanceRecords(updated);
    } catch {
      showToast('Failed to schedule maintenance', 'error');
    }
  };

  if (isLoading || !equipment) {
    return <LoadingSpinner message="Fetching equipment diagnostics and telemetry..." />;
  }

  // Format telemetry for charts
  const chartData = telemetryHistory.map((t) => ({
    time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: t.temperature,
    vibration: t.vibration,
    pressure: t.pressure,
    motor_current: t.motor_current,
    is_anomaly: t.is_anomaly,
  }));

  const openAlerts = alerts.filter((a) => a.status !== 'resolved');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Asset Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-lg shadow-md shrink-0">
            {equipment.equipment_code.split('-')[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
                {equipment.name}
              </h2>
              <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {equipment.equipment_code}
              </span>
              <StatusBadge status={equipment.operational_status} />
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {equipment.location}
              </span>
              <span>•</span>
              <span className="capitalize">Type: {equipment.equipment_type}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Installed: {equipment.installation_date ? new Date(equipment.installation_date).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            {equipment.description && (
              <p className="mt-2 text-xs text-slate-600 max-w-2xl">{equipment.description}</p>
            )}
          </div>
        </div>

        {/* CTA to AI Diagnostics */}
        <div className="flex items-center gap-3">
          <Link
            to={`/diagnostics?equipmentId=${equipment.id}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch AI Diagnostics</span>
          </Link>
        </div>
      </div>

      {/* Health Assessment Deep-Dive Card */}
      {health && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-4">
              <HealthGauge score={health.health_score} category={health.health_category} size="lg" />
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Equipment Health Assessment
                </h3>
                <p className="text-xs text-slate-500 max-w-xl">{health.assessment_explanation}</p>
              </div>
            </div>

            <div className="text-right font-mono text-xs space-y-1">
              <div className="text-slate-500">
                Signal Status: <span className="font-bold text-slate-900">{health.telemetry_status}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Latency: {health.minutes_since_last_reading !== null ? `${health.minutes_since_last_reading}m ago` : 'Never'}
              </div>
            </div>
          </div>

          {/* Contributing Factors Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
              Score Deduction Factors & Headroom
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {health.contributing_factors.map((cf, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    cf.impact === 'negative'
                      ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold font-mono">
                    <span>{cf.factor}</span>
                    <span>{cf.penalty_points > 0 ? `-${cf.penalty_points} pts` : 'Nominal'}</span>
                  </div>
                  <p className="text-[11px] opacity-90">{cf.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100 italic">
            * Methodology Note: {health.methodology_note}
          </div>
        </div>
      )}

      {/* Telemetry Charts: Temperature & Vibration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Chart */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bearing Temperature Trend (°C)</h3>
              <p className="text-xs text-slate-500 font-mono">
                Threshold: Warn ({equipment.sensor_thresholds?.temp_warn || 75}°C) | Crit ({equipment.sensor_thresholds?.temp_crit || 90}°C)
              </p>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
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
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature (°C)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vibration Chart */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">ISO 10816 Vibration Velocity (mm/s RMS)</h3>
              <p className="text-xs text-slate-500 font-mono">
                Threshold: Warn ({equipment.sensor_thresholds?.vib_warn || 4.5} mm/s) | Crit ({equipment.sensor_thresholds?.vib_crit || 7.1} mm/s)
              </p>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
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
                  type="monotone"
                  dataKey="vibration"
                  name="Vibration (mm/s)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Alarms Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Active Asset Alarms</h3>
            <p className="text-xs text-slate-500 font-mono">Threshold breaches and ML anomaly detections</p>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {openAlerts.length} Open
          </span>
        </div>

        {openAlerts.length > 0 ? (
          <div className="space-y-3">
            {openAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="font-semibold text-xs text-slate-900">{alert.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{alert.description}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Detection Trigger: {alert.detection_reason}
                  </p>
                </div>

                {isEngineer && (
                  <div className="flex items-center gap-2">
                    {alert.status === 'open' && (
                      <button
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => setResolveAlertId(alert.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      Resolve Alarm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            No unresolved alarms for this asset
          </div>
        )}
      </div>

      {/* Maintenance History & Scheduling */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Maintenance History & Work Orders</h3>
            <p className="text-xs text-slate-500 font-mono">Scheduled and historical maintenance interventions</p>
          </div>
          {isEngineer && (
            <button
              onClick={() => setIsMaintModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Service</span>
            </button>
          )}
        </div>

        {maintenanceRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Title / Scope</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Scheduled Date</th>
                  <th className="py-2.5 px-4">Assigned Tech</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {maintenanceRecords.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-semibold text-slate-800">{m.title}</td>
                    <td className="py-3 px-4 capitalize font-mono text-slate-600">{m.maintenance_type}</td>
                    <td className="py-3 px-4 capitalize font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.priority === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {m.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize font-mono text-slate-700">{m.status}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(m.scheduled_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{m.assigned_technician || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            No maintenance records filed for this equipment
          </div>
        )}
      </div>

      {/* Schedule Maintenance Modal */}
      <Modal
        isOpen={isMaintModalOpen}
        onClose={() => setIsMaintModalOpen(false)}
        title={`Schedule Maintenance for ${equipment.equipment_code}`}
      >
        <form onSubmit={handleScheduleMaintenance} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Work Order Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Bearing Re-greasing & Dynamic Balancing"
              value={maintTitle}
              onChange={(e) => setMaintTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
                Servicing Type
              </label>
              <select
                value={maintType}
                onChange={(e) => setMaintType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              >
                <option value="preventive">Preventive</option>
                <option value="corrective">Corrective</option>
                <option value="inspection">Inspection</option>
                <option value="emergency">Emergency</option>
                <option value="calibration">Calibration</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
                Priority
              </label>
              <select
                value={maintPriority}
                onChange={(e) => setMaintPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
                Scheduled Execution Date *
              </label>
              <input
                type="datetime-local"
                value={maintDate}
                onChange={(e) => setMaintDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
                Assigned Lead Technician
              </label>
              <input
                type="text"
                placeholder="e.g. Marcus Kane"
                value={maintTech}
                onChange={(e) => setMaintTech(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Work Instructions & Required Spares
            </label>
            <textarea
              rows={3}
              placeholder="Detail safety lockouts, spare part part numbers..."
              value={maintDesc}
              onChange={(e) => setMaintDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsMaintModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
            >
              Schedule Work Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Alert Modal */}
      <Modal
        isOpen={resolveAlertId !== null}
        onClose={() => setResolveAlertId(null)}
        title="Resolve Active Alarm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Document root-cause verification and corrective actions taken before closing this alarm.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Corrective Action & Engineering Notes *
            </label>
            <textarea
              rows={4}
              placeholder="e.g. Cleared suction strainer obstruction, verified normal discharge pressure at 4.2 bar, vibration normalized."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setResolveAlertId(null)}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResolveAlert}
              className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
            >
              Submit Resolution
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
