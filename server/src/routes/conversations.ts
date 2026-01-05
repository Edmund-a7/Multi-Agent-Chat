import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/ConversationService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取当前用户的所有对话
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversations = ConversationService.getByUserId(userId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: '获取对话列表失败' });
  }
});

// 获取单个对话
router.get('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const conversation = ConversationService.getById(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: '获取对话失败' });
  }
});

// 创建新对话
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: '对话名称不能为空' });
    }

    if (name.length < 1 || name.length > 100) {
      return res.status(400).json({ error: '对话名称长度应在 1-100 字符之间' });
    }

    const conversation = ConversationService.create(userId, name);
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: '创建对话失败' });
  }
});

// 更新对话
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: '对话名称不能为空' });
    }

    const success = ConversationService.update(conversationId, userId, name);
    if (!success) {
      return res.status(404).json({ error: '对话不存在或无权限修改' });
    }

    const conversation = ConversationService.getById(conversationId, userId);
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: '更新对话失败' });
  }
});

// 删除对话
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const success = ConversationService.delete(conversationId, userId);
    if (!success) {
      return res.status(404).json({ error: '对话不存在或无权限删除' });
    }

    res.json({ message: '对话删除成功' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: '删除对话失败' });
  }
});

// 获取对话的所有消息
router.get('/:id/messages', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const messages = ConversationService.getMessages(conversationId, userId);
    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    if (error.message === '对话不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 添加消息到对话（暂时只是保存，不调用 AI）
router.post('/:id/messages', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const { content, role_id } = req.body;

    if (!content) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    // 添加用户消息（position: 'right'）
    const message = ConversationService.addMessage(
      conversationId,
      userId,
      content,
      'right',
      role_id
    );

    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error adding message:', error);
    if (error.message === '对话不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '添加消息失败' });
  }
});

// 清空对话的所有消息
router.delete('/:id/messages', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const deletedCount = ConversationService.clearMessages(conversationId, userId);

    res.json({ message: '消息已清空', deletedCount });
  } catch (error: any) {
    console.error('Error clearing messages:', error);
    if (error.message === '对话不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '清空消息失败' });
  }
});

export default router;
