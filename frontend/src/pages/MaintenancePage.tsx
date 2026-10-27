import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Check,
  Search,
} from 'lucide-react';
import { maintenanceService } from '../services/maintenance';
import { equipmentService } from '../services/equipment';
import { MaintenanceRecord, Equipment } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const MaintenancePage: React.FC = () => {
  const { isEngineer } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number>(1);
  const [title, setTitle] = useState<string>('');
  const [maintType, setMaintType] = useState<string>('preventive');
  const [priority, setPriority] = useState<string>('medium');
  const [schedDate, setSchedDate] = useState<string>('');
  const [tech, setTech] = useState<string>('');
  const [desc, setDesc] = useState<string>('');

  // Complete Modal
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [workPerformed, setWorkPerformed] = useState<string>('');
  const [partsUsed, setPartsUsed] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmittingComplete, setIsSubmittingComplete] = useState<boolean>(false);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [statusFilter]);

  const loadEquipment = async () => {
    try {
      const data = await equipmentService.list();
      setEquipmentList(data);
      if (data.length > 0) setSelectedEquipmentId(data[0].id);
    } catch {
      // ignore
    }
  };

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await maintenanceService.list({
        status: statusFilter || undefined,
      });
      setRecords(data);
    } catch {
      showToast('Error loading maintenance logs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !schedDate) {
      showToast('Please provide a title and execution date', 'warning');
      return;
    }
    try {
      await maintenanceService.create({
        equipment_id: selectedEquipmentId,
        title,
        maintenance_type: maintType as any,
        priority: priority as any,
        scheduled_date: new Date(schedDate).toISOString(),
        assigned_technician: tech,
        description: desc,
      });
      showToast('Work order created and scheduled', 'success');
      setIsScheduleModalOpen(false);
      setTitle('');
      setDesc('');
      loadRecords();
    } catch {
      showToast('Failed to schedule work order', 'error');
    }
  };

  const handleCompleteSubmit = async () => {
    if (!completingRecord || !workPerformed.trim()) {
      showToast('Please specify the work performed by the technician', 'warning');
      return;
    }
    setIsSubmittingComplete(true);
    try {
      await maintenanceService.complete(completingRecord.id, {
        work_performed: workPerformed,
        parts_used: partsUsed || undefined,
        notes: notes || undefined,
      });
      showToast('Maintenance work order marked as completed', 'success');
      setCompletingRecord(null);
      setWorkPerformed('');
      setPartsUsed('');
      setNotes('');
      loadRecords();
    } catch {
      showToast('Failed to complete maintenance work order', 'error');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const getEquipmentCode = (equipmentId: number) => {
    const eq = equipmentList.find((e) => e.id === equipmentId);
    return eq ? eq.equipment_code : `EQ-${equipmentId}`;
  };

  const now = new Date();
  const overdueCount = records.filter(
    (r) => r.status !== 'completed' && r.status !== 'cancelled' && new Date(r.scheduled_date) < now
  ).length;
  const upcomingCount = records.filter(
    (r) => r.status === 'scheduled' && new Date(r.scheduled_date) >= now
  ).length;
  const completedCount = records.filter((r) => r.status === 'completed').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard title="Total Work Orders" value={records.length} icon={Wrench} />
        <MetricCard title="Upcoming Scheduled" value={upcomingCount} icon={Calendar} variant="default" />
        <MetricCard
          title="Overdue Servicing"
          value={overdueCount}
          icon={Clock}
          variant={overdueCount > 0 ? 'critical' : 'success'}
        />
        <MetricCard title="Completed Jobs" value={completedCount} icon={CheckCircle2} variant="success" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          {[
            { id: '', label: 'All Jobs' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-md transition-all ${
                statusFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isEngineer && (
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Work Order</span>
          </button>
        )}
      </div>

      {/* Work Orders List */}
      {isLoading ? (
        <LoadingSpinner message="Querying maintenance registry..." />
      ) : records.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Maintenance Records Found"
          description="There are no work orders matching this filter."
        />
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const isOverdue =
              record.status !== 'completed' &&
              record.status !== 'cancelled' &&
              new Date(record.scheduled_date) < now;

            return (
              <div
                key={record.id}
                className={`p-5 rounded-xl border bg-white shadow-sm transition-all flex flex-wrap items-center justify-between gap-4 ${
                  isOverdue ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {getEquipmentCode(record.equipment_id)}
                    </span>
                    <span className="capitalize font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {record.maintenance_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        record.priority === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : record.priority === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {record.priority}
                    </span>
                    <span className="text-slate-400">
                      Scheduled: {new Date(record.scheduled_date).toLocaleDateString()}
                    </span>
                    {isOverdue && (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        OVERDUE
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">{record.title}</h4>
                  {record.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">{record.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono pt-1">
                    <span>Lead Tech: <strong className="text-slate-700">{record.assigned_technician || 'Unassigned'}</strong></span>
                    {record.parts_used && <span>Parts: <span className="text-slate-700">{record.parts_used}</span></span>}
                  </div>

                  {record.status === 'completed' && record.work_performed && (
                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 font-mono">
                      <span className="font-bold">Work Performed: </span>
                      {record.work_performed}
                    </div>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0 font-mono">
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      record.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : isOverdue
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {record.status}
                  </span>

                  {isEngineer && record.status !== 'completed' && (
                    <button
                      onClick={() => setCompletingRecord(record)}
                      className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Complete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Work Order Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Industrial Work Order"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Target Asset *
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipment_code} — {eq.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Work Order Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Quarterly Bearing Lubrication & Thermal Survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
                Servicing Classification
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
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
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
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
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
                placeholder="e.g. Dave Kowalski"
                value={tech}
                onChange={(e) => setTech(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Work Description & Scope
            </label>
            <textarea
              rows={3}
              placeholder="Detailed instructions, required lockouts, inspection checklists..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
            >
              Confirm Work Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Work Order Modal */}
      <Modal
        isOpen={completingRecord !== null}
        onClose={() => setCompletingRecord(null)}
        title="Complete Maintenance Work Order"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Document technician work performed, parts consumed, and post-service testing.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Work Performed & Observations *
            </label>
            <textarea
              rows={4}
              placeholder="e.g. Replaced non-drive end bearing, greased with polyurea EP2 grease, tested vibration at 1.8 mm/s RMS."
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              Parts & Consumables Used
            </label>
            <input
              type="text"
              placeholder="e.g. SKF 6309 bearing, 2x O-rings, 400g grease"
              value={partsUsed}
              onChange={(e) => setPartsUsed(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase font-mono mb-1">
              General Notes / Follow-up Requirements
            </label>
            <textarea
              rows={2}
              placeholder="Follow-up vibration survey recommended in 30 days..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCompletingRecord(null)}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingComplete}
              onClick={handleCompleteSubmit}
              className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmittingComplete ? 'Saving...' : 'Mark Job Completed'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
