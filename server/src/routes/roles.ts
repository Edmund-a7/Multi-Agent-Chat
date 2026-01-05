import { Router, Request, Response } from 'express';
import { RoleService } from '../services/RoleService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取当前用户的所有角色
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const roles = RoleService.getByUserId(userId);
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: '获取角色列表失败' });
  }
});

// 获取单个角色
router.get('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const roleId = req.params.id;

    const role = RoleService.getById(roleId, userId);
    if (!role) {
      return res.status(404).json({ error: '角色不存在' });
    }

    res.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: '获取角色失败' });
  }
});

// 创建新角色
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, system_prompt, color } = req.body;

    // 验证输入
    if (!name || !system_prompt || !color) {
      return res.status(400).json({ error: '角色名称、系统提示词和颜色不能为空' });
    }

    if (name.length < 2) {
      return res.status(400).json({ error: '角色名称至少需要2个字符' });
    }

    if (system_prompt.length < 10) {
      return res.status(400).json({ error: '系统提示词至少需要10个字符' });
    }

    // 验证颜色格式（简单的十六进制颜色检查）
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: '颜色格式不正确，请使用十六进制格式（如 #3370ff）' });
    }

    const role = RoleService.create(userId, name, system_prompt, color, req.body.model);
    res.status(201).json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: '创建角色失败' });
  }
});

// 更新角色
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const roleId = req.params.id;
    const { name, system_prompt, color, model } = req.body;

    // 验证输入
    if (!name || !system_prompt || !color) {
      return res.status(400).json({ error: '角色名称、系统提示词和颜色不能为空' });
    }

    if (name.length < 2) {
      return res.status(400).json({ error: '角色名称至少需要2个字符' });
    }

    if (system_prompt.length < 10) {
      return res.status(400).json({ error: '系统提示词至少需要10个字符' });
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: '颜色格式不正确' });
    }

    const success = RoleService.update(roleId, userId, name, system_prompt, color, model);
    if (!success) {
      return res.status(404).json({ error: '角色不存在或无权限修改' });
    }

    // 返回更新后的角色
    const role = RoleService.getById(roleId, userId);
    res.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

// 删除角色
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const roleId = req.params.id;

    const success = RoleService.delete(roleId, userId);
    if (!success) {
      return res.status(404).json({ error: '角色不存在或无权限删除' });
    }

    res.json({ message: '角色删除成功' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: '删除角色失败' });
  }
});

export default router;
