import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Role, RoleInput } from '../types/role';
import { rolesApi } from '../services/rolesApi';
import { useAuth } from './AuthContext';

interface RolesContextType {
  roles: Role[];
  loading: boolean;
  fetchRoles: () => Promise<void>;
  createRole: (data: RoleInput) => Promise<Role>;
  updateRole: (id: string, data: RoleInput) => Promise<Role>;
  deleteRole: (id: string) => Promise<void>;
}

const RolesContext = createContext<RolesContextType | undefined>(undefined);

export function RolesProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // 获取角色列表
  const fetchRoles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await rolesApi.getAll();
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  // 创建角色
  const createRole = async (data: RoleInput): Promise<Role> => {
    const newRole = await rolesApi.create(data);
    setRoles(prev => [newRole, ...prev]);
    return newRole;
  };

  // 更新角色
  const updateRole = async (id: string, data: RoleInput): Promise<Role> => {
    const updatedRole = await rolesApi.update(id, data);
    setRoles(prev => prev.map(role => role.id === id ? updatedRole : role));
    return updatedRole;
  };

  // 删除角色
  const deleteRole = async (id: string): Promise<void> => {
    await rolesApi.delete(id);
    setRoles(prev => prev.filter(role => role.id !== id));
  };

  // 用户登录后自动加载角色
  useEffect(() => {
    if (user) {
      fetchRoles();
    } else {
      setRoles([]);
      setLoading(false);
    }
  }, [user]);

  return (
    <RolesContext.Provider value={{ roles, loading, fetchRoles, createRole, updateRole, deleteRole }}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RolesContext);
  if (context === undefined) {
    throw new Error('useRoles must be used within a RolesProvider');
  }
  return context;
}
