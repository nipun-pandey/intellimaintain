import api from './api';
import { MaintenanceRecord } from '../types';
import { mockStore } from './mockStore';

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const maintenanceService = {
  async list(params?: {
    equipment_id?: number;
    status?: string;
    priority?: string;
    maintenance_type?: string;
  }): Promise<MaintenanceRecord[]> {
    if (hasBackend) {
      try {
        const res = await api.get<MaintenanceRecord[]>('/api/v1/maintenance', { params });
        return res.data;
      } catch (err) {
        console.warn('Backend maintenance list failed, using demo work orders:', err);
      }
    }
    return mockStore.listMaintenance(params);
  },

  async create(data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    if (hasBackend) {
      try {
        const res = await api.post<MaintenanceRecord>('/api/v1/maintenance', data);
        return res.data;
      } catch (err) {
        console.warn('Backend maintenance create failed, using demo store:', err);
      }
    }
    return mockStore.createMaintenance(data);
  },

  async update(id: number, data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    if (hasBackend) {
      try {
        const res = await api.put<MaintenanceRecord>(`/api/v1/maintenance/${id}`, data);
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.listMaintenance().find((m) => m.id === id)!;
  },

  async complete(
    id: number,
    data: { work_performed: string; parts_used?: string; notes?: string }
  ): Promise<MaintenanceRecord> {
    if (hasBackend) {
      try {
        const res = await api.post<MaintenanceRecord>(`/api/v1/maintenance/${id}/complete`, data);
        return res.data;
      } catch (err) {
        console.warn('Backend maintenance complete failed, using demo store:', err);
      }
    }
    return mockStore.completeMaintenance(id, data);
  },
};
