import api from './api';
import type { Role, RoleInput } from '../types/role';

export const rolesApi = {
  // 获取所有角色
  getAll: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/roles');
    return response.data;
  },

  // 获取单个角色
  getById: async (id: string): Promise<Role> => {
    const response = await api.get<Role>(`/roles/${id}`);
    return response.data;
  },

  // 创建新角色
  create: async (data: RoleInput): Promise<Role> => {
    const response = await api.post<Role>('/roles', data);
    return response.data;
  },

  // 更新角色
  update: async (id: string, data: RoleInput): Promise<Role> => {
    const response = await api.put<Role>(`/roles/${id}`, data);
    return response.data;
  },

  // 删除角色
  delete: async (id: string): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },
};
