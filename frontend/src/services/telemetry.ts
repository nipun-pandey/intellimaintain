import api from './api';
import { Telemetry } from '../types';
import { mockStore } from './mockStore';

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

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const telemetryService = {
  async ingest(data: Partial<Telemetry>): Promise<Telemetry> {
    if (hasBackend) {
      try {
        const res = await api.post<Telemetry>('/api/v1/telemetry/ingest', data);
        return res.data;
      } catch {
        // fallback
      }
    }
    return {
      id: Date.now(),
      equipment_id: data.equipment_id || 1,
      timestamp: new Date().toISOString(),
      temperature: data.temperature || 55.0,
      vibration: data.vibration || 2.2,
      pressure: data.pressure || 3.2,
      motor_current: data.motor_current || 20.0,
      speed_rpm: data.speed_rpm || 1485,
      sensor_quality: 'good',
      is_anomaly: false,
    };
  },

  async getRecent(equipmentId: number, limit = 50): Promise<Telemetry[]> {
    if (hasBackend) {
      try {
        const res = await api.get<Telemetry[]>(`/api/v1/telemetry/equipment/${equipmentId}/recent`, {
          params: { limit },
        });
        return res.data;
      } catch (err) {
        console.warn('Backend recent telemetry failed, using demo feed:', err);
      }
    }
    return mockStore.getRecentTelemetry(equipmentId, limit);
  },

  async getHistory(equipmentId: number, params?: { startTime?: string; endTime?: string; limit?: number }): Promise<Telemetry[]> {
    if (hasBackend) {
      try {
        const res = await api.get<Telemetry[]>(`/api/v1/telemetry/equipment/${equipmentId}/history`, { params });
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.getRecentTelemetry(equipmentId, params?.limit || 50);
  },

  async getLatestAll(): Promise<Record<number, Telemetry>> {
    if (hasBackend) {
      try {
        const res = await api.get<Record<number, Telemetry>>('/api/v1/telemetry/latest');
        return res.data;
      } catch {
        // fallback
      }
    }
    const map: Record<number, Telemetry> = {};
    mockStore.listEquipment().forEach((eq) => {
      const recent = mockStore.getRecentTelemetry(eq.id, 1);
      if (recent.length > 0) map[eq.id] = recent[0];
    });
    return map;
  },

  async getAggregated(equipmentId: number, period = '24h'): Promise<AggregatePointsResponse> {
    if (hasBackend) {
      try {
        const res = await api.get<AggregatePointsResponse>(`/api/v1/telemetry/equipment/${equipmentId}/aggregate`, {
          params: { period },
        });
        return res.data;
      } catch (err) {
        console.warn('Backend aggregated telemetry failed, using demo aggregation:', err);
      }
    }
    return mockStore.getAggregatedTelemetry(equipmentId, period);
  },
};
