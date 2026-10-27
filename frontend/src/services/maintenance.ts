import api from './api';
import { MaintenanceRecord } from '../types';

export const maintenanceService = {
  async list(params?: {
    equipment_id?: number;
    status?: string;
    priority?: string;
    maintenance_type?: string;
  }): Promise<MaintenanceRecord[]> {
    const res = await api.get<MaintenanceRecord[]>('/api/v1/maintenance', { params });
    return res.data;
  },

  async create(data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    const res = await api.post<MaintenanceRecord>('/api/v1/maintenance', data);
    return res.data;
  },

  async update(id: number, data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    const res = await api.put<MaintenanceRecord>(`/api/v1/maintenance/${id}`, data);
    return res.data;
  },

  async complete(
    id: number,
    data: { work_performed: string; parts_used?: string; notes?: string }
  ): Promise<MaintenanceRecord> {
    const res = await api.post<MaintenanceRecord>(`/api/v1/maintenance/${id}/complete`, data);
    return res.data;
  },
};
