import db from '../database';
import fs from 'fs';

interface Message {
  id: string;
  conversation_id: string;
  role_id: string | null;
  content: string;
  position: 'left' | 'right';
  created_at: number;
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url', text?: string, image_url?: { url: string } }>;
}

export class ContextBuilder {
  /**
   * 构建对话上下文
   * @param conversationId 对话 ID
   * @param userId 用户 ID
   * @param maxMessages 最大消息数量
   * @returns AI 格式的消息数组
   */
  static buildContext(
    conversationId: string,
    userId: string,
    maxMessages: number = 10
  ): AIMessage[] {
    // 获取最近的 N 条消息（按时间倒序）
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(conversationId, maxMessages) as Message[];

    // 验证对话所有权
    const conversation = db.prepare(`
      SELECT user_id FROM conversations WHERE id = ?
    `).get(conversationId) as any;

    if (!conversation || conversation.user_id !== userId) {
      return [];
    }

    // 反转为时间正序（旧消息在前）
    const orderedMessages = messages.reverse();

    // 转换为 AI API 格式，并包含附件的文本内容
    return orderedMessages.map(msg => {
      let content: string | Array<any> = msg.content;

      // 获取该消息的附件
      const attachments = db.prepare(`
        SELECT file_name, file_type, extracted_text, file_path, mime_type
        FROM attachments
        WHERE message_id = ?
      `).all(msg.id) as any[];

      // 如果有附件
      if (attachments.length > 0) {
        // 分离图片和文档
        const imageAttachments = attachments.filter(att => att.file_type === 'image');
        const docAttachments = attachments.filter(att => att.file_type === 'document');

        // 如果有图片附件，使用视觉 API 格式（多模态消息）
        if (imageAttachments.length > 0) {
          const contentParts: Array<any> = [];

          // 添加文本部分
          if (msg.content) {
            contentParts.push({
              type: 'text',
              text: msg.content
            });
          }

          // 添加每个图片
          for (const img of imageAttachments) {
            try {
              // 读取图片文件并转换为 base64
              const imageBuffer = fs.readFileSync(img.file_path);
              const base64Image = imageBuffer.toString('base64');
              const dataUrl = `data:${img.mime_type};base64,${base64Image}`;

              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: dataUrl
                }
              });
            } catch (error) {
              console.error(`[ContextBuilder] 读取图片失败: ${img.file_name}`, error);
            }
          }

          content = contentParts;
        }

        // 对于文档附件，将提取的文本添加到内容中
        if (docAttachments.length > 0) {
          const attachmentTexts = docAttachments
            .filter(att => att.extracted_text)
            .map(att => `[附件 ${att.file_name}]:\n${att.extracted_text}`)
            .join('\n\n');

          if (attachmentTexts) {
            if (typeof content === 'string') {
              content = `${content}\n\n${attachmentTexts}`;
            } else if (Array.isArray(content)) {
              // 如果已经是数组格式（有图片），添加文档文本到第一个 text 部分
              const textPart = content.find(p => p.type === 'text');
              if (textPart) {
                textPart.text = `${textPart.text}\n\n${attachmentTexts}`;
              }
            }
          }
        }
      }

      return {
        role: msg.position === 'right' ? 'user' as const : 'assistant' as const,
        content,
      };
    });
  }

  /**
   * 估算上下文的 token 数量（粗略估计）
   * @param messages 消息数组
   * @returns 估算的 token 数量
   */
  static estimateTokens(messages: AIMessage[]): number {
    // 粗略估算：1 个 token ≈ 4 个字符（英文）或 1.5 个中文字符
    let totalChars = 0;

    for (const msg of messages) {
      totalChars += msg.content.length;
    }

    // 混合中英文的粗略估算：平均 2.5 个字符 = 1 token
    return Math.ceil(totalChars / 2.5);
  }

  /**
   * 获取对话统计信息
   * @param conversationId 对话 ID
   * @param userId 用户 ID
   * @returns 统计信息
   */
  static getConversationStats(conversationId: string, userId: string): {
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
  } {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN position = 'right' THEN 1 ELSE 0 END) as user_count,
        SUM(CASE WHEN position = 'left' THEN 1 ELSE 0 END) as ai_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.conversation_id = ? AND c.user_id = ?
    `).get(conversationId, userId) as any;

    return {
      totalMessages: stats?.total || 0,
      userMessages: stats?.user_count || 0,
      aiMessages: stats?.ai_count || 0,
    };
  }
}
