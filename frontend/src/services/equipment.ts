import api from './api';
import { Equipment, HealthAssessment } from '../types';
import { mockStore } from './mockStore';

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const equipmentService = {
  async list(params?: {
    search?: string;
    equipment_type?: string;
    operational_status?: string;
    include_archived?: boolean;
  }): Promise<Equipment[]> {
    if (hasBackend) {
      try {
        const res = await api.get<Equipment[]>('/api/v1/equipment', { params });
        return res.data;
      } catch (err) {
        console.warn('Backend equipment list failed, falling back to client demo:', err);
      }
    }
    return mockStore.listEquipment(params);
  },

  async get(id: number): Promise<Equipment> {
    if (hasBackend) {
      try {
        const res = await api.get<Equipment>(`/api/v1/equipment/${id}`);
        return res.data;
      } catch (err) {
        console.warn('Backend equipment get failed, falling back to client demo:', err);
      }
    }
    return mockStore.getEquipment(id);
  },

  async getHealth(id: number): Promise<HealthAssessment> {
    if (hasBackend) {
      try {
        const res = await api.get<HealthAssessment>(`/api/v1/health/equipment/${id}`);
        return res.data;
      } catch (err) {
        console.warn('Backend health get failed, using client heuristic:', err);
      }
    }
    return mockStore.getHealthAssessment(id);
  },

  async create(data: Partial<Equipment>): Promise<Equipment> {
    if (hasBackend) {
      try {
        const res = await api.post<Equipment>('/api/v1/equipment', data);
        return res.data;
      } catch (err) {
        console.warn('Backend equipment create failed, falling back to client demo:', err);
      }
    }
    return mockStore.createEquipment(data);
  },

  async update(id: number, data: Partial<Equipment>): Promise<Equipment> {
    if (hasBackend) {
      try {
        const res = await api.put<Equipment>(`/api/v1/equipment/${id}`, data);
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.getEquipment(id);
  },

  async archive(id: number): Promise<void> {
    if (hasBackend) {
      try {
        await api.delete(`/api/v1/equipment/${id}`);
        return;
      } catch {
        // fallback
      }
    }
    mockStore.archiveEquipment(id);
  },
};
