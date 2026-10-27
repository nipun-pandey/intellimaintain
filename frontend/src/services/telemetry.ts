import api from './api';
import { Telemetry } from '../types';

export interface AggregatePointsResponse {
  equipment_id: number;
  period: string;
  points: Array<{
    bucket_time: string;
    avg_temperature: number;
    max_temperature: number;
    avg_vibration: number;
    max_vibration: number;
    avg_pressure: number;
    avg_current: number;
    reading_count: number;
    anomaly_count: number;
  }>;
}

export const telemetryService = {
  async ingest(data: Partial<Telemetry>): Promise<Telemetry> {
    const res = await api.post<Telemetry>('/api/v1/telemetry/ingest', data);
    return res.data;
  },

  async getRecent(equipmentId: number, limit = 50): Promise<Telemetry[]> {
    const res = await api.get<Telemetry[]>(`/api/v1/telemetry/equipment/${equipmentId}/recent`, {
      params: { limit },
    });
    return res.data;
  },

  async getHistory(equipmentId: number, params?: { startTime?: string; endTime?: string; limit?: number }): Promise<Telemetry[]> {
    const res = await api.get<Telemetry[]>(`/api/v1/telemetry/equipment/${equipmentId}/history`, { params });
    return res.data;
  },

  async getLatestAll(): Promise<Record<number, Telemetry>> {
    const res = await api.get<Record<number, Telemetry>>('/api/v1/telemetry/latest');
    return res.data;
  },

  async getAggregated(equipmentId: number, period = '24h'): Promise<AggregatePointsResponse> {
    const res = await api.get<AggregatePointsResponse>(`/api/v1/telemetry/equipment/${equipmentId}/aggregate`, {
      params: { period },
    });
    return res.data;
  },
};
