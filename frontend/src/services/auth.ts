import api from './api';
import { User } from '../types';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/api/v1/auth/login', { username, password });
    return res.data;
  },

  async register(data: { email: string; full_name: string; password: string; role?: string }): Promise<User> {
    const res = await api.post<User>('/api/v1/auth/register', data);
    return res.data;
  },

  async getCurrentUser(): Promise<User> {
    const res = await api.get<User>('/api/v1/auth/me');
    return res.data;
  },
};
