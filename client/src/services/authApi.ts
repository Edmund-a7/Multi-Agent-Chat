import api from './api';
import type { AuthResponse } from '../types/auth';

export const authApi = {
  // 注册
  register: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', {
      username,
      password,
    });
    return response.data;
  },

  // 登录
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  // 获取当前用户信息
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};
