import api from './api';
import { SimulatorStatus } from '../types';

export const simulatorService = {
  async getStatus(): Promise<SimulatorStatus> {
    const res = await api.get<SimulatorStatus>('/api/v1/simulator/status');
    return res.data;
  },

  async start(equipment_id: number, scenario: string, interval_seconds = 2.0): Promise<SimulatorStatus> {
    const res = await api.post<SimulatorStatus>('/api/v1/simulator/start', {
      equipment_id,
      scenario,
      interval_seconds,
    });
    return res.data;
  },

  async stop(): Promise<SimulatorStatus> {
    const res = await api.post<SimulatorStatus>('/api/v1/simulator/stop');
    return res.data;
  },

  async reset(): Promise<SimulatorStatus> {
    const res = await api.post<SimulatorStatus>('/api/v1/simulator/reset');
    return res.data;
  },

  async getRecentReadings(): Promise<any[]> {
    const res = await api.get<any[]>('/api/v1/simulator/recent-readings');
    return res.data;
  },
};
