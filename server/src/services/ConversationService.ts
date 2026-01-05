import { randomUUID } from 'crypto';
import db from '../database';
import { Conversation, Message } from '../database/types';

export class ConversationService {
  // 获取用户的所有对话
  static getByUserId(userId: string): Conversation[] {
    const conversations = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(userId) as Conversation[];

    return conversations;
  }

  // 根据 ID 获取对话
  static getById(conversationId: string, userId: string): Conversation | undefined {
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId) as Conversation | undefined;

    return conversation;
  }

  // 创建新对话
  static create(userId: string, name: string): Conversation {
    const conversationId = randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO conversations (id, user_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(conversationId, userId, name, now, now);

    return {
      id: conversationId,
      user_id: userId,
      name,
      created_at: now,
      updated_at: now
    };
  }

  // 更新对话
  static update(conversationId: string, userId: string, name: string): boolean {
    const updated_at = Date.now();

    const result = db.prepare(`
      UPDATE conversations
      SET name = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(name, updated_at, conversationId, userId);

    return result.changes > 0;
  }

  // 删除对话
  static delete(conversationId: string, userId: string): boolean {
    const result = db.prepare(`
      DELETE FROM conversations
      WHERE id = ? AND user_id = ?
    `).run(conversationId, userId);

    return result.changes > 0;
  }

  // 更新对话的最后更新时间
  static touch(conversationId: string): void {
    const updated_at = Date.now();
    db.prepare(`
      UPDATE conversations
      SET updated_at = ?
      WHERE id = ?
    `).run(updated_at, conversationId);
  }

  // 获取对话的所有消息
  static getMessages(conversationId: string, userId: string): Message[] {
    // 首先验证对话是否属于该用户
    const conversation = this.getById(conversationId, userId);
    if (!conversation) {
      throw new Error('对话不存在或无权访问');
    }

    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId) as Message[];

    // 为每条消息添加附件信息
    const messagesWithAttachments = messages.map(msg => {
      const attachments = db.prepare(`
        SELECT id, file_name, file_type, file_size, mime_type, created_at
        FROM attachments
        WHERE message_id = ?
      `).all(msg.id);

      return {
        ...msg,
        attachments: attachments.length > 0 ? attachments : undefined
      };
    });

    return messagesWithAttachments;
  }

  // 添加消息
  static addMessage(
    conversationId: string,
    userId: string,
    content: string,
    position: 'left' | 'right',
    roleId?: string,
    messageId?: string  // 可选的预定义消息 ID
  ): Message {
    // 验证对话是否属于该用户
    const conversation = this.getById(conversationId, userId);
    if (!conversation) {
      throw new Error('对话不存在或无权访问');
    }

    const finalMessageId = messageId || randomUUID();
    const created_at = Date.now();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, role_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(finalMessageId, conversationId, roleId || null, content, position, created_at);

    // 更新对话的最后更新时间
    this.touch(conversationId);

    return {
      id: finalMessageId,
      conversation_id: conversationId,
      role_id: roleId || null,
      content,
      position,
      created_at
    };
  }

  // 根据 ID 获取消息
  static getMessageById(messageId: string, userId: string): Message | undefined {
    const message = db.prepare(`
      SELECT m.* FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ? AND c.user_id = ?
    `).get(messageId, userId) as Message | undefined;

    return message;
  }

  // 删除消息
  static deleteMessage(messageId: string, userId: string): boolean {
    // 首先验证消息是否属于该用户的对话
    const message = this.getMessageById(messageId, userId);
    if (!message) {
      throw new Error('消息不存在或无权访问');
    }

    const result = db.prepare(`
      DELETE FROM messages
      WHERE id = ?
    `).run(messageId);

    // 更新对话的最后更新时间
    this.touch(message.conversation_id);

    return result.changes > 0;
  }

  // 清空对话中的所有消息
  static clearMessages(conversationId: string, userId: string): number {
    // 首先验证对话是否属于该用户
    const conversation = this.getById(conversationId, userId);
    if (!conversation) {
      throw new Error('对话不存在或无权访问');
    }

    // 删除所有相关附件
    db.prepare(`
      DELETE FROM attachments
      WHERE message_id IN (
        SELECT id FROM messages WHERE conversation_id = ?
      )
    `).run(conversationId);

    // 删除所有消息
    const result = db.prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
    `).run(conversationId);

    // 更新对话的最后更新时间
    this.touch(conversationId);

    return result.changes;
  }
}
