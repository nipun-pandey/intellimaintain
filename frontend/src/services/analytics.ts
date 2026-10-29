import api from './api';
import { DashboardData } from '../types';
import { mockStore } from './mockStore';

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const analyticsService = {
  async getDashboard(days = 7): Promise<DashboardData> {
    if (hasBackend) {
      try {
        const res = await api.get<DashboardData>('/api/v1/analytics/dashboard', { params: { days } });
        return res.data;
      } catch (err) {
        console.warn('Backend dashboard query failed, using demo analytics:', err);
      }
    }
    return mockStore.getDashboard(days);
  },

  async seedDemoData(): Promise<any> {
    if (hasBackend) {
      try {
        const res = await api.post('/api/v1/seed-demo-data');
        return res.data;
      } catch {
        // fallback
      }
    }
    return { status: 'success', message: 'Demo data re-initialized' };
  },
};
