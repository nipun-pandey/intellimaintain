import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ShieldAlert,
  Sparkles,
  Search,
  Check,
} from 'lucide-react';
import { alertService } from '../services/alerts';
import { equipmentService } from '../services/equipment';
import { Alert, Equipment } from '../types';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const AlertsPage: React.FC = () => {
  const { isEngineer } = useAuth();
  const { showToast } = useToast();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Resolve Modal
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, severityFilter, typeFilter, equipmentFilter]);

  const loadEquipment = async () => {
    try {
      const data = await equipmentService.list();
      setEquipmentList(data);
    } catch {
      // ignore
    }
  };

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await alertService.list({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        alert_type: typeFilter || undefined,
        equipment_id: equipmentFilter ? Number(equipmentFilter) : undefined,
      });
      setAlerts(data);
    } catch {
      showToast('Error loading alarms and anomaly logs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await alertService.acknowledge(alertId);
      showToast('Alert transitioned to Acknowledged state', 'success');
      loadAlerts();
    } catch {
      showToast('Failed to acknowledge alert', 'error');
    }
  };

  const handleResolve = async () => {
    if (!selectedAlert || !resolutionNotes.trim()) {
      showToast('Please document corrective resolution notes', 'warning');
      return;
    }

    setIsResolving(true);
    try {
      await alertService.resolve(selectedAlert.id, resolutionNotes);
      showToast(`Alarm '${selectedAlert.title}' closed successfully`, 'success');
      setSelectedAlert(null);
      setResolutionNotes('');
      loadAlerts();
    } catch {
      showToast('Failed to resolve alarm', 'error');
    } finally {
      setIsResolving(false);
    }
  };

  const getEquipmentCode = (equipmentId: number) => {
    const eq = equipmentList.find((e) => e.id === equipmentId);
    return eq ? eq.equipment_code : `EQ-${equipmentId}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filtering Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          {['open', 'acknowledged', 'resolved', ''].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === '' ? 'All Alarms' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Equipment Filter */}
          <select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Equipment</option>
            {equipmentList.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.equipment_code}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Detection Types</option>
            <option value="threshold_violation">Threshold Violation</option>
            <option value="ml_anomaly">Isolation Forest ML Anomaly</option>
            <option value="rapid_change">Rate-of-Change Transient</option>
            <option value="stale_telemetry">Stale Signal Drop</option>
          </select>
        </div>
      </div>

      {/* Alarms Feed Table / Cards */}
      {isLoading ? (
        <LoadingSpinner message="Filtering alarm log stream..." />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No Matching Alarms"
          description="There are no alarms matching the selected filters. All assets are operating within bounds."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-xl border bg-white shadow-sm transition-all flex flex-wrap items-center justify-between gap-4 ${
                alert.severity === 'critical' && alert.status !== 'resolved'
                  ? 'border-rose-300 ring-1 ring-rose-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <SeverityBadge severity={alert.severity} />
                  <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {getEquipmentCode(alert.equipment_id)}
                  </span>
                  {alert.alert_type === 'ml_anomaly' ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      <span>ML Anomaly</span>
                    </span>
                  ) : alert.alert_type === 'stale_telemetry' ? (
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full">
                      Signal Drop
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Threshold Violation
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 tracking-tight">{alert.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>

                {alert.detection_reason && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    Reason: <span className="text-slate-700">{alert.detection_reason}</span>
                  </p>
                )}

                {alert.status === 'resolved' && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 font-mono space-y-0.5">
                    <span className="font-bold">Resolved by {alert.resolved_by || 'Engineer'}:</span>
                    <p className="text-emerald-800">{alert.resolution_notes}</p>
                  </div>
                )}
              </div>

              {/* Actions & Status */}
              <div className="flex flex-col items-end gap-2 shrink-0 font-mono">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                    alert.status === 'open'
                      ? 'bg-rose-100 text-rose-800'
                      : alert.status === 'acknowledged'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {alert.status}
                </span>

                {isEngineer && alert.status !== 'resolved' && (
                  <div className="flex items-center gap-2 mt-2">
                    {alert.status === 'open' && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      Resolve Alarm
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Alarm Modal */}
      <Modal
        isOpen={selectedAlert !== null}
        onClose={() => setSelectedAlert(null)}
        title={`Resolve Alarm: ${selectedAlert?.title}`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
            <span className="font-semibold">Asset: </span>
            {selectedAlert && getEquipmentCode(selectedAlert.equipment_id)}
            <br />
            <span className="font-semibold">Trigger: </span>
            {selectedAlert?.detection_reason}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Document Engineering Resolution & Corrective Action *
            </label>
            <textarea
              rows={4}
              placeholder="e.g. Cleared discharge blockage, flushed seal piping, confirmed vibration velocity normalized back to 1.9 mm/s RMS."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setSelectedAlert(null)}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResolving}
              onClick={handleResolve}
              className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isResolving ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
