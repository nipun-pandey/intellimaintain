import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Modal } from '../common/Modal';
import { SimulatorControlPanel } from '../simulator/SimulatorControlPanel';
import { simulatorService } from '../../services/simulator';
import { alertService } from '../../services/alerts';
import { SimulatorStatus } from '../../types';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus | null>(null);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState<boolean>(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);

  useEffect(() => {
    fetchInitialState();
    const interval = setInterval(fetchInitialState, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialState = async () => {
    try {
      const [simStatus, alerts] = await Promise.all([
        simulatorService.getStatus(),
        alertService.list({ status: 'open' }),
      ]);
      setSimulatorStatus(simStatus);
      setActiveAlertsCount(alerts.length);
    } catch {
      // offline or unauthenticated
    }
  };

  const handleStopSimulator = async () => {
    try {
      const updated = await simulatorService.stop();
      setSimulatorStatus(updated);
    } catch {
      // ignore
    }
  };

  // Derive title from pathname
  let pageTitle = 'Plant Operations Overview';
  let pageSubtitle = 'Real-time telemetry, predictive health assessments, and alarm monitoring';

  if (location.pathname.startsWith('/equipment')) {
    pageTitle = 'Equipment Assets Directory';
    pageSubtitle = 'Asset registry, operational thresholds, and lifecycle management';
  } else if (location.pathname.startsWith('/monitoring')) {
    pageTitle = 'Live Industrial Monitoring Console';
    pageSubtitle = 'High-frequency telemetry streams, signal quality, and live trending';
  } else if (location.pathname.startsWith('/alerts')) {
    pageTitle = 'Alarms & Anomaly Manager';
    pageSubtitle = 'Deterministic threshold breaches, ML anomaly alerts, and engineer resolution workflows';
  } else if (location.pathname.startsWith('/maintenance')) {
    pageTitle = 'Preventive & Corrective Maintenance';
    pageSubtitle = 'Work order scheduling, overdue servicing tracking, and technician history';
  } else if (location.pathname.startsWith('/analytics')) {
    pageTitle = 'Deep Telemetry Analytics';
    pageSubtitle = 'Historical sensor aggregations, wear trends, and parameter correlation';
  } else if (location.pathname.startsWith('/diagnostics')) {
    pageTitle = 'Evidence-Based AI Diagnostics';
    pageSubtitle = 'Root-cause analysis, failure mode hypotheses, and recommended inspections';
  } else if (location.pathname.startsWith('/settings')) {
    pageTitle = 'Platform Settings & Environment';
    pageSubtitle = 'System status, alert rule management, and simulation configurations';
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar activeAlertsCount={activeAlertsCount} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={pageTitle}
          subtitle={pageSubtitle}
          simulatorStatus={simulatorStatus}
          onOpenSimulator={() => setIsSimulatorModalOpen(true)}
          onStopSimulator={handleStopSimulator}
          activeAlertsCount={activeAlertsCount}
        />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

      {/* Simulator Modal */}
      <Modal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        title="Industrial Telemetry Simulator Controls"
        maxWidth="2xl"
      >
        <SimulatorControlPanel
          onStatusChange={(newStatus) => setSimulatorStatus(newStatus)}
        />
      </Modal>
    </div>
  );
};
