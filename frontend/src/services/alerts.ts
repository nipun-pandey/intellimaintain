import api from './api';
import { Alert } from '../types';
import { mockStore } from './mockStore';

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const alertService = {
  async list(params?: {
    equipment_id?: number;
    status?: string;
    severity?: string;
    alert_type?: string;
  }): Promise<Alert[]> {
    if (hasBackend) {
      try {
        const res = await api.get<Alert[]>('/api/v1/alerts', { params });
        return res.data;
      } catch (err) {
        console.warn('Backend alerts list failed, falling back to demo alerts:', err);
      }
    }
    return mockStore.listAlerts(params);
  },

  async get(id: number): Promise<Alert> {
    if (hasBackend) {
      try {
        const res = await api.get<Alert>(`/api/v1/alerts/${id}`);
        return res.data;
      } catch {
        // fallback
      }
    }
    const a = mockStore.listAlerts().find((item) => item.id === id);
    if (!a) throw new Error('Alert not found');
    return a;
  },

  async acknowledge(id: number, acknowledged_by?: string): Promise<Alert> {
    if (hasBackend) {
      try {
        const res = await api.post<Alert>(`/api/v1/alerts/${id}/acknowledge`, { acknowledged_by });
        return res.data;
      } catch (err) {
        console.warn('Backend alert acknowledge failed, using demo store:', err);
      }
    }
    return mockStore.acknowledgeAlert(id);
  },

  async resolve(id: number, resolution_notes: string, resolved_by?: string): Promise<Alert> {
    if (hasBackend) {
      try {
        const res = await api.post<Alert>(`/api/v1/alerts/${id}/resolve`, {
          resolution_notes,
          resolved_by,
        });
        return res.data;
      } catch (err) {
        console.warn('Backend alert resolve failed, using demo store:', err);
      }
    }
    return mockStore.resolveAlert(id, resolution_notes);
  },
};
