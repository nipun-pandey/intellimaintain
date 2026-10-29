import api from './api';
import { DiagnosticReport } from '../types';
import { mockStore } from './mockStore';

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const diagnosticsService = {
  async getReport(equipmentId: number): Promise<DiagnosticReport> {
    if (hasBackend) {
      try {
        const res = await api.get<DiagnosticReport>(`/api/v1/diagnostics/equipment/${equipmentId}`);
        return res.data;
      } catch (err) {
        console.warn('Backend diagnostic service failed, using client expert FMEA engine:', err);
      }
    }
    return mockStore.getDiagnostics(equipmentId);
  },
};
