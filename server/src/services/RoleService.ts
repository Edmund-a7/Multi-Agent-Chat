import { randomUUID } from 'crypto';
import db from '../database';
import { Role } from '../database/types';

export class RoleService {
  // 获取用户的所有角色
  static getByUserId(userId: string): Role[] {
    const roles = db.prepare(`
      SELECT * FROM roles
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Role[];

    return roles;
  }

  // 根据 ID 获取角色
  static getById(roleId: string, userId: string): Role | undefined {
    const role = db.prepare(`
      SELECT * FROM roles
      WHERE id = ? AND user_id = ?
    `).get(roleId, userId) as Role | undefined;

    return role;
  }

  // 创建新角色
  static create(userId: string, name: string, systemPrompt: string, color: string, model?: string): Role {
    const roleId = randomUUID();
    const created_at = Date.now();

    db.prepare(`
      INSERT INTO roles (id, user_id, name, system_prompt, color, model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(roleId, userId, name, systemPrompt, color, model || null, created_at);

    return {
      id: roleId,
      user_id: userId,
      name,
      system_prompt: systemPrompt,
      color,
      model: model || undefined,
      created_at
    };
  }

  // 更新角色
  static update(roleId: string, userId: string, name: string, systemPrompt: string, color: string, model?: string): boolean {
    const result = db.prepare(`
      UPDATE roles
      SET name = ?, system_prompt = ?, color = ?, model = ?
      WHERE id = ? AND user_id = ?
    `).run(name, systemPrompt, color, model || null, roleId, userId);

    return result.changes > 0;
  }

  // 删除角色
  static delete(roleId: string, userId: string): boolean {
    const result = db.prepare(`
      DELETE FROM roles
      WHERE id = ? AND user_id = ?
    `).run(roleId, userId);

    return result.changes > 0;
  }

  // 初始化默认角色（用户首次注册时）
  static initDefaultRoles(userId: string): void {
    const defaultRoles = [
      {
        name: 'Developer',
        system_prompt: '你是一个资深软件开发工程师，精通多种编程语言和框架。你擅长解决技术问题，编写高质量代码，并能够清晰地解释复杂的技术概念。你的回答应该准确、实用，并包含代码示例。',
        color: '#3370ff'
      },
      {
        name: 'Designer',
        system_prompt: '你是一个经验丰富的 UX/UI 设计师，对用户体验和视觉设计有深刻理解。你擅长创建直观、美观的界面，并能够提供设计建议、配色方案和布局优化。你的回答应该注重用户体验和视觉美感。',
        color: '#f7ba1e'
      },
      {
        name: 'Product Manager',
        system_prompt: '你是一个经验丰富的产品经理，擅长产品规划、需求分析和项目管理。你能够从用户需求出发，制定产品策略，平衡技术可行性和商业价值。你的回答应该关注产品目标、用户价值和商业影响。',
        color: '#00b42a'
      }
    ];

    defaultRoles.forEach(role => {
      this.create(userId, role.name, role.system_prompt, role.color);
    });
  }
}
