import api from './api';
import { DiagnosticReport } from '../types';

export const diagnosticsService = {
  async getReport(equipmentId: number): Promise<DiagnosticReport> {
    const res = await api.get<DiagnosticReport>(`/api/v1/diagnostics/equipment/${equipmentId}`);
    return res.data;
  },
};
