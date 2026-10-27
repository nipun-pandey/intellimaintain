import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Wrench,
  Search,
  Activity,
} from 'lucide-react';
import { diagnosticsService } from '../services/diagnostics';
import { equipmentService } from '../services/equipment';
import { Equipment, DiagnosticReport } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const DiagnosticsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialEquipmentId = searchParams.get('equipmentId');
  const { showToast } = useToast();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number>(
    initialEquipmentId ? Number(initialEquipmentId) : 1
  );
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    if (selectedEquipmentId) {
      runDiagnostics();
    }
  }, [selectedEquipmentId]);

  const loadEquipment = async () => {
    try {
      const data = await equipmentService.list();
      setEquipmentList(data);
      if (data.length > 0 && !selectedEquipmentId) {
        setSelectedEquipmentId(data[0].id);
      }
    } catch {
      // ignore
    }
  };

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const rep = await diagnosticsService.getReport(selectedEquipmentId);
      setReport(rep);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to synthesize diagnostic assessment', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const currentEquipment = equipmentList.find((e) => e.id === selectedEquipmentId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono mb-1">
              Select Industrial Asset for Diagnostic Inference
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
            Subsystem: <span className="text-slate-800 font-medium capitalize">{currentEquipment?.equipment_type}</span>
          </div>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isLoading ? 'Synthesizing...' : 'Re-Run Diagnostic Assessment'}</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Evaluating sensor evidence, alarm severities, and FMEA failure trees..." />
      ) : !report ? (
        <EmptyState
          icon={Sparkles}
          title="Diagnostic Assistant Idle"
          description="Select an asset above to execute evidence-based reliability diagnostics."
        />
      ) : (
        <div className="space-y-6">
          {/* Header Assessment Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg font-mono ${
                    report.risk_level === 'Critical'
                      ? 'bg-rose-100 text-rose-700'
                      : report.risk_level === 'Elevated'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {report.risk_level.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Diagnostic Summary for {report.equipment_code}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                        report.risk_level === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : report.risk_level === 'Elevated'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {report.risk_level} Risk Level
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Asset: {report.equipment_name}
                  </p>
                </div>
              </div>

              {/* Inference Engine Badge */}
              <div className="text-right font-mono text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{report.engine_used}</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Synthesized: {new Date(report.generated_at).toLocaleString()}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
              {report.observations_summary}
            </p>
          </div>

          {/* Section 1: Measured Physical Evidence (Facts) */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Section 1: Verified Physical Telemetry Evidence</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Empirical sensor data retrieved directly from the time-series database (never hallucinated).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Monitored Parameter</th>
                    <th className="py-2.5 px-4">Latest Ingested Reading</th>
                    <th className="py-2.5 px-4">Safe Envelope / Threshold</th>
                    <th className="py-2.5 px-4">Condition Status</th>
                    <th className="py-2.5 px-4">Historical 20-Sample Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.measured_evidence.map((ev, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{ev.metric}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        {ev.latest_value} {ev.unit}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{ev.threshold || 'N/A'}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ev.status === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : ev.status === 'Warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{ev.historical_context || 'Nominal'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Possible Causes (FMEA Hypotheses) */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2 pb-2 border-b border-slate-100">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Section 2: Plausible Failure Mode Hypotheses (FMEA)</span>
            </h4>
            <div className="space-y-2">
              {report.possible_causes.map((cause, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/60 border border-amber-200/80 text-xs text-amber-950 font-sans">
                  <span className="font-mono font-bold text-amber-700 shrink-0 mt-0.5">#{i + 1}</span>
                  <p className="leading-relaxed">{cause}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Suggested Diagnostic Checks */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2 pb-2 border-b border-slate-100">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span>Section 3: Suggested Physical Diagnostic Checks</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-slate-600 uppercase font-mono border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Inspection Procedure</th>
                    <th className="py-2.5 px-4">Subsystem</th>
                    <th className="py-2.5 px-4">Priority</th>
                    <th className="py-2.5 px-4">Engineering Test Steps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.suggested_checks.map((chk, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">{chk.check_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 capitalize">{chk.subsystem}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                            chk.priority === 'Immediate'
                              ? 'bg-rose-100 text-rose-800'
                              : chk.priority === 'High'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {chk.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 leading-relaxed">{chk.procedure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Recommended Next Steps */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2 pb-2 border-b border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Section 4: Recommended Operations & Maintenance Actions</span>
            </h4>
            <ul className="space-y-2">
              {report.recommended_actions.map((act, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{act}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 5: Uncertainty & Limitations */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs text-slate-500 space-y-1 font-mono">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Section 5: Uncertainty & Operational Limitations</span>
            </div>
            <p className="leading-relaxed text-[11px] font-sans text-slate-600">
              {report.uncertainty_and_limitations}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
