import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import db from '../database';
import { User } from '../database/types';
import { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } from '../config/constants';
import { RoleService } from './RoleService';

export class AuthService {
  // 注册新用户
  static async register(username: string, password: string): Promise<{ user: Omit<User, 'password_hash'>, token: string }> {
    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    // 加密密码
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 创建用户
    const userId = randomUUID();
    const created_at = Date.now();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, username, password_hash, created_at);

    // 初始化默认角色
    RoleService.initDefaultRoles(userId);

    // 生成 JWT token
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      user: { id: userId, username, created_at },
      token
    };
  }

  // 用户登录
  static async login(username: string, password: string): Promise<{ user: Omit<User, 'password_hash'>, token: string }> {
    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

    if (!user) {
      throw new Error('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('用户名或密码错误');
    }

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      },
      token
    };
  }

  // 验证 token
  static verifyToken(token: string): { userId: string; username: string } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
