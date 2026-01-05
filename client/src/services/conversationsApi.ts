import api from './api';
import type { Conversation, ConversationInput, Message, MessageInput } from '../types/conversation';

export const conversationsApi = {
  // 获取所有对话
  getAll: async (): Promise<Conversation[]> => {
    const response = await api.get<Conversation[]>('/conversations');
    return response.data;
  },

  // 获取单个对话
  getById: async (id: string): Promise<Conversation> => {
    const response = await api.get<Conversation>(`/conversations/${id}`);
    return response.data;
  },

  // 创建新对话
  create: async (data: ConversationInput): Promise<Conversation> => {
    const response = await api.post<Conversation>('/conversations', data);
    return response.data;
  },

  // 更新对话
  update: async (id: string, data: ConversationInput): Promise<Conversation> => {
    const response = await api.put<Conversation>(`/conversations/${id}`, data);
    return response.data;
  },

  // 删除对话
  delete: async (id: string): Promise<void> => {
    await api.delete(`/conversations/${id}`);
  },

  // 获取对话的所有消息
  getMessages: async (id: string): Promise<Message[]> => {
    const response = await api.get<Message[]>(`/conversations/${id}/messages`);
    return response.data;
  },

  // 添加消息到对话
  addMessage: async (id: string, data: MessageInput): Promise<Message> => {
    const response = await api.post<Message>(`/conversations/${id}/messages`, data);
    return response.data;
  },

  // 发送消息并获取 AI 回复
  chatWithAI: async (id: string, data: MessageInput): Promise<{ userMessage: Message; aiMessage: Message }> => {
    const response = await api.post(`/chat`, {
      conversation_id: id,
      content: data.content,
      role_id: data.role_id,
    });
    return response.data;
  },

  // 删除消息
  deleteMessage: async (messageId: string): Promise<void> => {
    await api.delete(`/chat/message/${messageId}`);
  },

  // 重新生成消息
  regenerateMessage: async (messageId: string): Promise<{ aiMessage: Message }> => {
    const response = await api.post(`/chat/regenerate/${messageId}`);
    return response.data;
  },

  // 清空对话的所有消息
  clearMessages: async (conversationId: string): Promise<{ message: string; deletedCount: number }> => {
    const response = await api.delete(`/conversations/${conversationId}/messages`);
    return response.data;
  },

  // 流式聊天（使用 EventSource）
  chatWithAIStream: (
    id: string,
    data: MessageInput,
    callbacks: {
      onUserMessage: (message: Message) => void;
      onAIMessageStart: (messageId: string, roleId: string | null) => void;
      onAIMessageChunk: (chunk: string) => void;
      onAIMessageComplete: (message: Message) => void;
      onError: (error: string) => void;
    }
  ): (() => void) => {
    const token = localStorage.getItem('token');
    const baseURL = api.defaults.baseURL || 'http://localhost:3000/api';

    console.log('[Frontend SSE] 发起请求:', baseURL + '/chat/stream');
    console.log('[Frontend SSE] 对话ID:', id, '内容:', data.content.substring(0, 50));
    console.log('[Frontend SSE] 附件:', data.attachments);

    // 使用 fetch 进行流式请求
    const controller = new AbortController();

    fetch(`${baseURL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: id,
        content: data.content,
        role_id: data.role_id,
        attachments: data.attachments,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        console.log('[Frontend SSE] 响应状态:', response.status, response.statusText);
        console.log('[Frontend SSE] 响应头:', response.headers);

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No reader available');
        }

        let buffer = '';
        let currentEvent = '';
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('[Frontend SSE] 流结束');
            break;
          }

          chunkCount++;
          const decoded = decoder.decode(value, { stream: true });
          console.log(`[Frontend SSE] 收到数据块 #${chunkCount}, 大小:`, decoded.length);
          console.log(`[Frontend SSE] 数据块内容:`, decoded.substring(0, 200));

          buffer += decoded;
          const lines = buffer.split('\n');

          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine === '') {
              // 空行表示事件结束
              currentEvent = '';
              continue;
            }

            if (trimmedLine.startsWith('event: ')) {
              currentEvent = trimmedLine.slice(7).trim();
              console.log('[Frontend SSE] 事件类型:', currentEvent);
            } else if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const eventData = JSON.parse(jsonStr);
                console.log('[Frontend SSE] 解析数据:', eventData);

                switch (currentEvent) {
                  case 'user_message':
                    console.log('[Frontend SSE] 触发 onUserMessage');
                    console.log('[Frontend SSE] user_message 原始数据:', JSON.stringify(eventData, null, 2));
                    console.log('[Frontend SSE] user_message attachments?', eventData.attachments);
                    callbacks.onUserMessage(eventData);
                    break;
                  case 'ai_message_start':
                    console.log('[Frontend SSE] 触发 onAIMessageStart');
                    callbacks.onAIMessageStart(eventData.id, eventData.role_id);
                    break;
                  case 'ai_message_chunk':
                    console.log('[Frontend SSE] 触发 onAIMessageChunk, 块长度:', eventData.chunk?.length);
                    callbacks.onAIMessageChunk(eventData.chunk);
                    break;
                  case 'ai_message_complete':
                    console.log('[Frontend SSE] 触发 onAIMessageComplete');
                    callbacks.onAIMessageComplete(eventData);
                    break;
                  case 'error':
                    console.error('[Frontend SSE] 收到错误:', eventData.error);
                    callbacks.onError(eventData.error);
                    break;
                }
              } catch (e) {
                console.error('[Frontend SSE] JSON 解析错误:', e);
                console.error('[Frontend SSE] 原始行:', trimmedLine);
              }
            }
          }
        }
      })
      .catch((error) => {
        console.error('[Frontend SSE] 请求错误:', error);
        if (error.name !== 'AbortError') {
          callbacks.onError(error.message || '连接失败');
        }
      });

    // 返回取消函数
    return () => controller.abort();
  },
};
