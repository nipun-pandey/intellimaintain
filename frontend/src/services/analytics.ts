import api from './api';
import { DashboardData } from '../types';

export const analyticsService = {
  async getDashboard(days = 7): Promise<DashboardData> {
    const res = await api.get<DashboardData>('/api/v1/analytics/dashboard', { params: { days } });
    return res.data;
  },

  async seedDemoData(): Promise<any> {
    const res = await api.post('/api/v1/seed-demo-data');
    return res.data;
  },
};
