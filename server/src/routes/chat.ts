import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/ConversationService';
import { RoleService } from '../services/RoleService';
import { AIService } from '../services/AIService';
import { ContextBuilder } from '../services/ContextBuilder';
import { authMiddleware } from '../middleware/auth';
import { randomUUID } from 'crypto';
import db from '../database';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 保存附件到数据库
function saveAttachments(messageId: string, attachments: any[]) {
  if (!attachments || attachments.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO attachments (id, message_id, file_name, file_type, file_size, file_path, mime_type, extracted_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const attachment of attachments) {
    stmt.run(
      attachment.id,
      messageId,
      attachment.file_name,
      attachment.file_type,
      attachment.file_size,
      attachment.file_path,
      attachment.mime_type,
      attachment.extracted_text || null,
      Date.now()
    );
  }
}

// 获取消息的附件
function getAttachments(messageId: string) {
  return db.prepare(`
    SELECT id, file_name, file_type, file_size, mime_type, created_at
    FROM attachments
    WHERE message_id = ?
  `).all(messageId);
}

// 发送消息并获取 AI 回复
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversation_id, role_id, content } = req.body;

    // 验证输入
    if (!conversation_id || !content) {
      return res.status(400).json({ error: '对话ID和消息内容不能为空' });
    }

    // 1. 添加用户消息
    const userMessage = ConversationService.addMessage(
      conversation_id,
      userId,
      content,
      'right',
      role_id
    );

    // 2. 获取 AI 配置
    const aiConfig = AIService.getConfig(userId);
    if (!aiConfig || !aiConfig.api_key) {
      return res.status(400).json({
        error: '请先在设置中配置 AI API',
        userMessage,
      });
    }

    // 3. 获取角色的 system prompt 和 model
    let systemPrompt = '你是一个helpful的AI助手。';
    if (role_id) {
      const role = RoleService.getById(role_id, userId);
      if (role) {
        systemPrompt = role.system_prompt;
        // 如果角色指定了模型，覆盖全局配置
        if (role.model) {
          aiConfig.model = role.model;
        }
      }
    }

    // 4. 获取对话历史（使用 ContextBuilder）
    const recentMessages = ContextBuilder.buildContext(
      conversation_id,
      userId,
      aiConfig.max_context_messages
    );

    // 5. 调用 AI API
    try {
      const aiResponse = await AIService.chat(aiConfig, systemPrompt, recentMessages);


      // 6. 保存 AI 回复
      const aiMessage = ConversationService.addMessage(
        conversation_id,
        userId,
        aiResponse,
        'left',
        role_id
      );

      // 7. 返回结果
      res.json({
        userMessage,
        aiMessage,
      });
    } catch (aiError: any) {
      // AI 调用失败，返回用户消息但标记 AI 错误
      return res.status(500).json({
        error: aiError.message || 'AI 调用失败',
        userMessage,
      });
    }
  } catch (error: any) {
    console.error('Error in chat:', error);
    if (error.message === '对话不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '发送消息失败' });
  }
});

// 流式聊天（Server-Sent Events）
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversation_id, role_id, content, attachments } = req.body;

    // 验证输入
    if (!conversation_id || !content) {
      return res.status(400).json({ error: '对话ID和消息内容不能为空' });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 1. 添加用户消息并立即返回
    const userMessage = ConversationService.addMessage(
      conversation_id,
      userId,
      content,
      'right',
      role_id
    );

    // 保存附件
    if (attachments && attachments.length > 0) {
      saveAttachments(userMessage.id, attachments);
    }

    // 获取附件信息返回给前端
    const attachmentsData = getAttachments(userMessage.id);
    const userMessageWithAttachments = {
      ...userMessage,
      attachments: attachmentsData,
    };

    // 发送用户消息事件
    res.write(`event: user_message\n`);
    res.write(`data: ${JSON.stringify(userMessageWithAttachments)}\n\n`);

    // 2. 获取 AI 配置
    const aiConfig = AIService.getConfig(userId);

    if (!aiConfig || !aiConfig.api_key) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: '请先在设置中配置 AI API' })}\n\n`);
      res.end();
      return;
    }

    // 3. 获取角色的 system prompt 和 model
    let systemPrompt = '你是一个helpful的AI助手。';
    if (role_id) {
      const role = RoleService.getById(role_id, userId);
      if (role) {
        systemPrompt = role.system_prompt;
        if (role.model) {
          aiConfig.model = role.model;
        }
      }
    }

    // 检测是否是图片生成模型（提前检测以优化性能）
    const imageModelKeywords = ['dall-e', 'gpt-image', 'flux', 'sd-', 'sdxl', 'stable-diffusion', 'midjourney'];
    const geminiImageKeywords = ['gemini', 'image'];

    const modelLower = aiConfig.model.toLowerCase();
    const isGeminiImageModel = geminiImageKeywords.every(keyword => modelLower.includes(keyword));
    const isOtherImageModel = imageModelKeywords.some(keyword => modelLower.includes(keyword));
    const isImageModel = isGeminiImageModel || isOtherImageModel;

    // 4. 获取对话历史（图片生成模型跳过，避免加载大图片造成卡顿）
    let recentMessages: any[] = [];
    if (!isImageModel) {
      recentMessages = ContextBuilder.buildContext(
        conversation_id,
        userId,
        aiConfig.max_context_messages
      );
    }

    // 5. 创建临时 AI 消息 ID
    const aiMessageId = randomUUID();
    res.write(`event: ai_message_start\n`);
    res.write(`data: ${JSON.stringify({ id: aiMessageId, role_id })}\n\n`);

    // 6. 流式调用 AI API 或图片生成 API
    try {
      let fullContent = '';
      let chunkCount = 0;
      let finalContent: string;

      if (isGeminiImageModel) {
        // 使用 Gemini 原生格式 API
        console.log('[Chat Stream] 检测到 Gemini 图片生成模型，使用 /v1beta 原生格式端点');
        res.write(`event: ai_message_chunk\n`);
        res.write(`data: ${JSON.stringify({ id: aiMessageId, chunk: '正在使用 Gemini 生成图片...\n' })}\n\n`);

        // 提取用户的提示词（去掉 @角色名 前缀）
        const imagePrompt = content.replace(/@\S+\s*/, '').trim() || content;

        finalContent = await AIService.generateImageGemini(
          aiConfig,
          imagePrompt,
          aiConfig.model
        );

        console.log('[Chat Stream] Gemini 返回内容前100字:', finalContent.substring(0, 100));

        // 提取并发送思考过程（如果有）
        const reasoningMatch = finalContent.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
        if (reasoningMatch && reasoningMatch[1]) {
          res.write(`event: ai_message_chunk\n`);
          res.write(`data: ${JSON.stringify({ id: aiMessageId, chunk: `[REASONING]${reasoningMatch[1]}[/REASONING]` })}\n\n`);
        }

        fullContent = finalContent;
      } else if (isOtherImageModel) {
        res.write(`event: ai_message_chunk\n`);
        res.write(`data: ${JSON.stringify({ id: aiMessageId, chunk: '正在生成图片...\n' })}\n\n`);

        // 提取用户的提示词（去掉 @角色名 前缀）
        const imagePrompt = content.replace(/@\S+\s*/, '').trim() || content;

        finalContent = await AIService.generateImage(
          aiConfig,
          imagePrompt,
          aiConfig.model,
          '1024x1024'
        );
        fullContent = finalContent;
      } else {
        // 使用流式聊天 API
        finalContent = await AIService.chatStream(
          aiConfig,
          systemPrompt,
          recentMessages,
          (chunk: string) => {
            chunkCount++;
            fullContent += chunk;
            res.write(`event: ai_message_chunk\n`);
            res.write(`data: ${JSON.stringify({ id: aiMessageId, chunk })}\n\n`);
          }
        );
      }

      // 提取思考过程标记（用于保留在消息中）
      const reasoningMatch = finalContent.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
      const reasoningPart = reasoningMatch ? `[REASONING]${reasoningMatch[1]}[/REASONING]` : '';

      // 清理思考过程和 JSON_IMAGE 标记，得到纯内容
      let pureContent = finalContent
        .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/g, '')
        .replace(/JSON_IMAGE:\{[^}]+\}/g, '')
        .trim();

      let generatedAttachment = null;

      // 检查是否有图片
      const imageMatch = finalContent.match(/JSON_IMAGE:(\{[^}]+\})/);
      if (imageMatch) {
        try {
          const fileInfo = JSON.parse(imageMatch[1]);
          const attachmentId = randomUUID();

          generatedAttachment = {
            id: attachmentId,
            file_name: fileInfo.filename,
            file_type: fileInfo.mimetype.startsWith('image/') ? 'image' : 'document',
            file_size: fileInfo.size,
            file_path: fileInfo.path,
            mime_type: fileInfo.mimetype,
            extracted_text: null
          };

        } catch (e) {
          console.error('[Chat Stream] 解析图片 JSON 失败:', e);
          pureContent = '生成图片时发生错误';
        }
      }

      // 构建最终消息内容：思考过程 + 纯内容
      const finalMessageContent = reasoningPart + pureContent;

      // 7. 保存完整的 AI 回复（使用之前发送给前端的消息 ID）
      const aiMessage = ConversationService.addMessage(
        conversation_id,
        userId,
        finalMessageContent,
        'left',
        role_id,
        aiMessageId  // 使用预定义的 ID，确保与前端临时消息匹配
      );

      if (generatedAttachment) {
        saveAttachments(aiMessage.id, [generatedAttachment]);
      }

      // 8. 发送完成事件（包含附件信息以便前端立即显示）
      const messageWithAttachments = {
        ...aiMessage,
        attachments: generatedAttachment ? [{
          id: generatedAttachment.id,
          file_name: generatedAttachment.file_name,
          file_type: generatedAttachment.file_type,
          file_size: generatedAttachment.file_size,
          mime_type: generatedAttachment.mime_type,
        }] : undefined
      };
      res.write(`event: ai_message_complete\n`);
      res.write(`data: ${JSON.stringify(messageWithAttachments)}\n\n`);
      res.end();
    } catch (aiError: any) {
      console.error('[Chat Stream] AI 调用错误:', aiError.message);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: aiError.message || 'AI 调用失败' })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('[Chat Stream] 顶层错误:', error);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: '发送消息失败' })}\n\n`);
    res.end();
  }
});

// 获取对话统计信息（用于显示上下文信息）
router.get('/stats/:conversationId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: '对话ID不能为空' });
    }

    const stats = ContextBuilder.getConversationStats(conversationId, userId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting conversation stats:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

// 删除消息
router.delete('/message/:messageId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({ error: '消息ID不能为空' });
    }

    // 删除消息（会验证权限）
    ConversationService.deleteMessage(messageId, userId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    if (error.message === '消息不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '删除消息失败' });
  }
});

// 重新生成 AI 回复
router.post('/regenerate/:messageId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({ error: '消息ID不能为空' });
    }

    // 获取要重新生成的消息
    const message = ConversationService.getMessageById(messageId, userId);
    if (!message || message.position !== 'left') {
      return res.status(400).json({ error: '只能重新生成 AI 消息' });
    }

    // 获取对话ID和角色ID
    const { conversation_id, role_id } = message;

    // 删除原消息
    ConversationService.deleteMessage(messageId, userId);

    // 获取 AI 配置
    const aiConfig = AIService.getConfig(userId);
    if (!aiConfig || !aiConfig.api_key) {
      return res.status(400).json({ error: '请先在设置中配置 AI API' });
    }

    // 3. 获取角色的 system prompt 和 model
    let systemPrompt = '你是一个helpful的AI助手。';
    if (role_id) {
      const role = RoleService.getById(role_id, userId);
      if (role) {
        systemPrompt = role.system_prompt;
        // 如果角色指定了模型，覆盖全局配置
        if (role.model) {
          aiConfig.model = role.model;
        }
      }
    }

    // 获取对话历史
    const recentMessages = ContextBuilder.buildContext(
      conversation_id,
      userId,
      aiConfig.max_context_messages
    );

    // 调用 AI API
    try {
      const aiResponse = await AIService.chat(aiConfig, systemPrompt, recentMessages);

      // 保存新的 AI 回复
      const aiMessage = ConversationService.addMessage(
        conversation_id,
        userId,
        aiResponse,
        'left',
        role_id || undefined
      );

      res.json({ aiMessage });
    } catch (aiError: any) {
      return res.status(500).json({
        error: aiError.message || 'AI 调用失败',
      });
    }
  } catch (error: any) {
    console.error('Error regenerating message:', error);
    if (error.message === '消息不存在或无权访问') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: '重新生成失败' });
  }
});

export default router;
