import api from './api';
import { SimulatorStatus } from '../types';
import { mockStore } from './mockStore';

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const simulatorService = {
  async getStatus(): Promise<SimulatorStatus> {
    if (hasBackend) {
      try {
        const res = await api.get<SimulatorStatus>('/api/v1/simulator/status');
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.getSimulatorStatus();
  },

  async start(equipment_id: number, scenario: string, interval_seconds = 2.0): Promise<SimulatorStatus> {
    if (hasBackend) {
      try {
        const res = await api.post<SimulatorStatus>('/api/v1/simulator/start', {
          equipment_id,
          scenario,
          interval_seconds,
        });
        return res.data;
      } catch (err) {
        console.warn('Backend simulator start failed, using client simulation engine:', err);
      }
    }
    return mockStore.startSimulator(equipment_id, scenario, interval_seconds);
  },

  async stop(): Promise<SimulatorStatus> {
    if (hasBackend) {
      try {
        const res = await api.post<SimulatorStatus>('/api/v1/simulator/stop');
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.stopSimulator();
  },

  async reset(): Promise<SimulatorStatus> {
    if (hasBackend) {
      try {
        const res = await api.post<SimulatorStatus>('/api/v1/simulator/reset');
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.resetSimulator();
  },

  async getRecentReadings(): Promise<any[]> {
    if (hasBackend) {
      try {
        const res = await api.get<any[]>('/api/v1/simulator/recent-readings');
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.getSimulatorReadings();
  },
};
