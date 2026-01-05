import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

// 扩展 Express Request 类型，添加 user 属性
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
      };
    }
  }
}

// JWT 验证中间件
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 从 Authorization header 获取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀

    // 验证 token
    const decoded = AuthService.verifyToken(token);
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ error: '认证令牌无效' });
  }
}
