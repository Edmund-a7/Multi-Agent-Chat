import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少需要3个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }

    const result = await AuthService.register(username, password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: '注册失败' });
    }
  }
});

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const result = await AuthService.login(username, password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: '登录失败' });
    }
  }
});

// 获取当前用户信息（需要认证）
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
