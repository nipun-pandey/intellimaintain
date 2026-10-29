import api from './api';
import { User } from '../types';
import { mockStore } from './mockStore';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

const hasBackend = Boolean(import.meta.env.VITE_API_URL);

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    if (hasBackend) {
      try {
        const res = await api.post<LoginResponse>('/api/v1/auth/login', { username, password });
        return res.data;
      } catch (err) {
        console.warn('Backend login failed, falling back to client demo session:', err);
      }
    }
    return mockStore.login(username);
  },

  async register(data: { email: string; full_name: string; password: string; role?: string }): Promise<User> {
    if (hasBackend) {
      try {
        const res = await api.post<User>('/api/v1/auth/register', data);
        return res.data;
      } catch (err) {
        console.warn('Backend registration failed, using client demo:', err);
      }
    }
    return mockStore.login(data.email).user;
  },

  async getCurrentUser(): Promise<User> {
    if (hasBackend) {
      try {
        const res = await api.get<User>('/api/v1/auth/me');
        return res.data;
      } catch {
        // fallback
      }
    }
    return mockStore.getCurrentUser();
  },
};
