import { Router, Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取 AI 配置
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const config = AIService.getConfig(userId);

    if (!config) {
      return res.json({
        base_url: 'https://api.openai.com/v1',
        api_key: '',
        model: 'gpt-3.5-turbo',
        max_context_messages: 10,
      });
    }

    // 不返回完整的 API key，只返回前几位
    res.json({
      ...config,
      api_key: config.api_key ? `${config.api_key.substring(0, 7)}...` : '',
      api_key_configured: !!config.api_key,
    });
  } catch (error) {
    console.error('Error fetching AI config:', error);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 保存 AI 配置
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { base_url, api_key, model, max_context_messages } = req.body;

    // 验证
    if (!base_url || !api_key || !model) {
      return res.status(400).json({ error: 'API Base URL、API Key 和 Model 不能为空' });
    }

    // 验证 URL 格式
    try {
      new URL(base_url);
    } catch {
      return res.status(400).json({ error: 'API Base URL 格式不正确' });
    }

    AIService.saveConfig(userId, {
      base_url,
      api_key,
      model,
      max_context_messages,
    });

    res.json({ message: 'AI 配置保存成功' });
  } catch (error) {
    console.error('Error saving AI config:', error);
    res.status(500).json({ error: '保存配置失败' });
  }
});

import axios from 'axios';

// 获取可用模型列表
router.post('/models', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { base_url } = req.body;
    let apiKey = '';

    // 如果前端没有传 api_key（通常这样），尝试从已保存的配置中获取
    const savedConfig = AIService.getConfig(userId);
    if (savedConfig && savedConfig.api_key) {
      apiKey = savedConfig.api_key;
    } else if (req.body.api_key) {
      apiKey = req.body.api_key;
    }

    if (!base_url) {
      return res.status(400).json({ error: 'API Base URL is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required/configured' });
    }

    // 构造请求
    // 注意：有些兼容 OpenAI 的 API 可能不需要 /v1 后缀，或者 base_url 已经包含 /v1
    // 这里我们简单处理，直接请求 base_url + '/models' (或者如果 base_url 包含 /v1 就在那里)
    // 通常 base_url 应该是 https://api.openai.com/v1 这样的形式
    let url = base_url;
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (!url.endsWith('/models')) {
      url = url + '/models';
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    res.json({ models: response.data.data || [] });
  } catch (error: any) {
    console.error('Error fetching models:', error.message);
    res.status(500).json({ error: '获取模型列表失败: ' + (error.response?.data?.error?.message || error.message) });
  }
});

export default router;
