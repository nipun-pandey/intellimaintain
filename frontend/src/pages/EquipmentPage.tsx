import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, Cpu, ArrowUpRight, Archive, Check } from 'lucide-react';
import { equipmentService } from '../services/equipment';
import { Equipment } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HealthGauge } from '../components/common/HealthGauge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const EquipmentPage: React.FC = () => {
  const { isEngineer, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add Equipment Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    equipment_code: '',
    name: '',
    equipment_type: 'pump',
    location: '',
    description: '',
    operational_status: 'operational',
    temp_warn: 75.0,
    temp_crit: 90.0,
    vib_warn: 4.5,
    vib_crit: 7.1,
    press_min: 1.5,
    press_max: 6.0,
    current_max: 35.0,
  });

  useEffect(() => {
    loadEquipment();
  }, [search, typeFilter, statusFilter]);

  const loadEquipment = async () => {
    setIsLoading(true);
    try {
      const data = await equipmentService.list({
        search: search || undefined,
        equipment_type: typeFilter || undefined,
        operational_status: statusFilter || undefined,
      });
      setEquipmentList(data);
    } catch {
      showToast('Error loading equipment catalog', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipment_code || !formData.name || !formData.location) {
      showToast('Please fill all required asset metadata', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await equipmentService.create({
        equipment_code: formData.equipment_code.toUpperCase().trim(),
        name: formData.name.trim(),
        equipment_type: formData.equipment_type,
        location: formData.location.trim(),
        description: formData.description,
        operational_status: formData.operational_status as any,
        sensor_thresholds: {
          temp_warn: Number(formData.temp_warn),
          temp_crit: Number(formData.temp_crit),
          vib_warn: Number(formData.vib_warn),
          vib_crit: Number(formData.vib_crit),
          press_min: Number(formData.press_min),
          press_max: Number(formData.press_max),
          current_max: Number(formData.current_max),
        },
      });

      showToast(`Asset '${formData.equipment_code}' registered successfully`, 'success');
      setIsAddModalOpen(false);
      setFormData({
        equipment_code: '',
        name: '',
        equipment_type: 'pump',
        location: '',
        description: '',
        operational_status: 'operational',
        temp_warn: 75.0,
        temp_crit: 90.0,
        vib_warn: 4.5,
        vib_crit: 7.1,
        press_min: 1.5,
        press_max: 6.0,
        current_max: 35.0,
      });
      loadEquipment();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to create equipment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: number, code: string) => {
    if (!confirm(`Are you sure you want to archive equipment ${code}?`)) return;
    try {
      await equipmentService.archive(id);
      showToast(`Equipment ${code} archived`, 'info');
      loadEquipment();
    } catch {
      showToast('Failed to archive equipment', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, asset name, or location..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Equipment Types</option>
            <option value="pump">Pump</option>
            <option value="compressor">Compressor</option>
            <option value="motor">Motor</option>
            <option value="fan">Fan</option>
            <option value="hydraulic_press">Hydraulic Press</option>
            <option value="turbine">Turbine</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Operational Statuses</option>
            <option value="operational">Operational</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {isEngineer && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register Asset</span>
          </button>
        )}
      </div>

      {/* Equipment Table */}
      {isLoading ? (
        <LoadingSpinner message="Querying industrial asset catalog..." />
      ) : equipmentList.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No Equipment Matches Your Criteria"
          description="Try adjusting your search terms or clearing the selected filters."
          actionText="Clear Filters"
          onAction={() => {
            setSearch('');
            setTypeFilter('');
            setStatusFilter('');
          }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Asset Code</th>
                  <th className="py-3 px-4">Equipment Details</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Operational Status</th>
                  <th className="py-3 px-4">Health Index</th>
                  <th className="py-3 px-4">Telemetry Last Seen</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {equipmentList.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-slate-900">
                      <Link to={`/equipment/${eq.id}`} className="hover:text-blue-600 transition-colors">
                        {eq.equipment_code}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{eq.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono capitalize">
                        Type: {eq.equipment_type}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600">{eq.location}</td>
                    <td className="py-4 px-4">
                      <StatusBadge status={eq.operational_status} />
                    </td>
                    <td className="py-4 px-4">
                      <HealthGauge score={eq.health_score} category={eq.health_category} size="sm" />
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                      {eq.latest_telemetry_timestamp
                        ? new Date(eq.latest_telemetry_timestamp).toLocaleString()
                        : 'No Data'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/equipment/${eq.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          View Details
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => handleArchive(eq.id, eq.equipment_code)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Archive asset"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Industrial Equipment Asset"
        maxWidth="xl"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1">
                Asset Identifier Code *
              </label>
              <input
                type="text"
                placeholder="e.g. COMP-301"
                value={formData.equipment_code}
                onChange={(e) => setFormData({ ...formData, equipment_code: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1">
                Asset Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Secondary Air Compressor"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1">
                Equipment Classification
              </label>
              <select
                value={formData.equipment_type}
                onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pump">Centrifugal Pump</option>
                <option value="compressor">Air / Gas Compressor</option>
                <option value="motor">Induction Motor</option>
                <option value="fan">Cooling Tower / Draft Fan</option>
                <option value="hydraulic_press">Hydraulic Press</option>
                <option value="turbine">Steam / Gas Turbine</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1">
                Physical Location *
              </label>
              <input
                type="text"
                placeholder="e.g. Building B - Sector 3"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-1">
              Operational Scope & Description
            </label>
            <textarea
              rows={2}
              placeholder="Primary plant function, critical operational constraints..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Threshold Configurations */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-800 font-mono uppercase tracking-wider mb-2">
              Sensor Alarm Envelope Parameters
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 font-mono">Temp Warn (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.temp_warn}
                  onChange={(e) => setFormData({ ...formData, temp_warn: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 font-mono">Temp Crit (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.temp_crit}
                  onChange={(e) => setFormData({ ...formData, temp_crit: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 font-mono">Vib Warn (mm/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.vib_warn}
                  onChange={(e) => setFormData({ ...formData, vib_warn: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 font-mono">Vib Crit (mm/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.vib_crit}
                  onChange={(e) => setFormData({ ...formData, vib_crit: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 font-mono">Max Current (A)</label>
                <input
                  type="number"
                  step="1"
                  value={formData.current_max}
                  onChange={(e) => setFormData({ ...formData, current_max: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Equipment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
