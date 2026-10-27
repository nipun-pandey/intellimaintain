import api from './api';
import { Alert } from '../types';

export const alertService = {
  async list(params?: {
    equipment_id?: number;
    status?: string;
    severity?: string;
    alert_type?: string;
  }): Promise<Alert[]> {
    const res = await api.get<Alert[]>('/api/v1/alerts', { params });
    return res.data;
  },

  async get(id: number): Promise<Alert> {
    const res = await api.get<Alert>(`/api/v1/alerts/${id}`);
    return res.data;
  },

  async acknowledge(id: number, acknowledged_by?: string): Promise<Alert> {
    const res = await api.post<Alert>(`/api/v1/alerts/${id}/acknowledge`, { acknowledged_by });
    return res.data;
  },

  async resolve(id: number, resolution_notes: string, resolved_by?: string): Promise<Alert> {
    const res = await api.post<Alert>(`/api/v1/alerts/${id}/resolve`, {
      resolution_notes,
      resolved_by,
    });
    return res.data;
  },
};
