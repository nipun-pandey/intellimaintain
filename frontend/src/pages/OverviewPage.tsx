import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Bell,
  Clock,
  Calendar,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { HealthGauge } from '../components/common/HealthGauge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { analyticsService } from '../services/analytics';
import { equipmentService } from '../services/equipment';
import { DashboardData, Equipment } from '../types';
import { useToast } from '../context/ToastContext';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8'];

export const OverviewPage: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [days, setDays] = useState<number>(7);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  useEffect(() => {
    fetchDashboard();
  }, [days]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const [dashData, eqData] = await Promise.all([
        analyticsService.getDashboard(days),
        equipmentService.list(),
      ]);
      setData(dashData);
      setEquipmentList(eqData);
    } catch {
      showToast('Error connecting to predictive maintenance backend', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      await analyticsService.seedDemoData();
      showToast('Demonstration industrial assets populated successfully', 'success');
      await fetchDashboard();
    } catch {
      showToast('Failed to populate demonstration data', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Aggregating plant telemetrics..." />;
  }

  if (!data || data.kpis.total_equipment === 0) {
    return (
      <EmptyState
        icon={Database}
        title="No Industrial Equipment Recorded"
        description="The predictive maintenance database contains no active asset telemetry. Populate realistic industrial demonstration assets to preview the system."
        actionText={isSeeding ? 'Seeding...' : 'Populate Demonstration Assets'}
        onAction={handleSeedDemo}
      />
    );
  }

  const { kpis, health_distribution, telemetry_trends, latest_alerts } = data;

  // Format distribution for Recharts
  const pieData = Object.entries(health_distribution || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Plant Health Status</h2>
          <p className="text-xs text-slate-500 font-mono">
            Aggregate Fleet Reliability Index: <span className="font-bold text-blue-600">{kpis.system_mean_health}/100</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Days selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs font-medium">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md transition-all ${
                  days === d ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>

          <button
            onClick={fetchDashboard}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monitored Fleet"
          value={kpis.total_equipment}
          subtitle={`${kpis.healthy_equipment} healthy assets (${Math.round((kpis.healthy_equipment / Math.max(1, kpis.total_equipment)) * 100)}%)`}
          icon={Cpu}
          variant="default"
        />

        <MetricCard
          title="Active Alarms"
          value={kpis.active_alerts}
          subtitle={`${kpis.critical_alerts} critical alarms requiring action`}
          icon={Bell}
          variant={kpis.critical_alerts > 0 ? 'critical' : kpis.active_alerts > 0 ? 'warning' : 'success'}
        />

        <MetricCard
          title="At-Risk Assets"
          value={kpis.critical_equipment + kpis.attention_equipment}
          subtitle={`${kpis.critical_equipment} critical, ${kpis.attention_equipment} requiring attention`}
          icon={AlertTriangle}
          variant={kpis.critical_equipment > 0 ? 'critical' : 'warning'}
        />

        <MetricCard
          title="Scheduled Servicing"
          value={kpis.upcoming_maintenance}
          subtitle={`${kpis.overdue_maintenance} overdue work orders`}
          icon={Calendar}
          variant={kpis.overdue_maintenance > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Charts Section: Health Distribution & Telemetry Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Trend Area Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Fleet Sensor Telemetry Trends</h3>
              <p className="text-xs text-slate-500 font-mono">Aggregated Temperature (°C) vs Vibration (mm/s RMS)</p>
            </div>
            <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded border">
              Window: {days}d
            </span>
          </div>

          <div className="h-64 w-full">
            {telemetry_trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry_trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="vibGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_temp"
                    name="Avg Temp (°C)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#tempGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_vib"
                    name="Avg Vib (mm/s)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#vibGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                No telemetry points recorded in selected period
              </div>
            )}
          </div>
        </div>

        {/* Health Distribution Pie Chart (1 col) */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Fleet Condition Breakdown</h3>
            <p className="text-xs text-slate-500 font-mono">Multi-Factor Heuristic Health Categories</p>
          </div>

          <div className="h-56 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
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
                  verticalAlign="bottom"
                  iconSize={8}
                  formatter={(value) => <span className="text-[11px] text-slate-600 font-mono">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Equipment Status Directory Table & Recent Alerts Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipment Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Live Equipment Telemetric Matrix</h3>
              <p className="text-xs text-slate-500 font-mono">Real-time condition, active alarms, and health ratings</p>
            </div>
            <Link
              to="/equipment"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <span>View All Assets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Equipment Code</th>
                  <th className="py-3 px-4">Name / Subsystem</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Health Index</th>
                  <th className="py-3 px-4">Open Alarms</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {equipmentList.slice(0, 6).map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-slate-900">
                      <Link to={`/equipment/${eq.id}`} className="hover:text-blue-600 transition-colors">
                        {eq.equipment_code}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{eq.name}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{eq.equipment_type} • {eq.location}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={eq.operational_status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <HealthGauge score={eq.health_score} category={eq.health_category} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {eq.active_alerts_count && eq.active_alerts_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          {eq.active_alerts_count} Active
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Link
                        to={`/equipment/${eq.id}`}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-block"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latest Active Alarms Preview (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Alarms & Events</h3>
              <Link to="/alerts" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {latest_alerts.length > 0 ? (
                latest_alerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{alert.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="capitalize">{alert.alert_type.replace('_', ' ')}</span>
                      <span className="capitalize font-semibold text-slate-700">{alert.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 font-mono">
                  No active alarms on record
                </div>
              )}
            </div>
          </div>

          <Link
            to="/alerts"
            className="mt-4 w-full py-2 text-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
          >
            Launch Alarm Center
          </Link>
        </div>
      </div>
    </div>
  );
};
