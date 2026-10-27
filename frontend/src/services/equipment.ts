import api from './api';
import { Equipment } from '../types';

export const equipmentService = {
  async list(params?: {
    search?: string;
    equipment_type?: string;
    operational_status?: string;
    include_archived?: boolean;
  }): Promise<Equipment[]> {
    const res = await api.get<Equipment[]>('/api/v1/equipment', { params });
    return res.data;
  },

  async get(id: number): Promise<Equipment> {
    const res = await api.get<Equipment>(`/api/v1/equipment/${id}`);
    return res.data;
  },

  async create(data: Partial<Equipment>): Promise<Equipment> {
    const res = await api.post<Equipment>('/api/v1/equipment', data);
    return res.data;
  },

  async update(id: number, data: Partial<Equipment>): Promise<Equipment> {
    const res = await api.put<Equipment>(`/api/v1/equipment/${id}`, data);
    return res.data;
  },

  async archive(id: number): Promise<void> {
    await api.delete(`/api/v1/equipment/${id}`);
  },
};
