import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Conversation, Message } from '../types/conversation';
import { conversationsApi } from '../services/conversationsApi';
import { useAuth } from './AuthContext';
import { Message as ArcoMessage } from '@arco-design/web-react';

interface ConversationContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  isStreaming: boolean;
  fetchConversations: () => Promise<void>;
  createConversation: (name: string) => Promise<Conversation>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (content: string, roleId?: string, attachments?: any[]) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  clearMessages: () => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const { user } = useAuth();

  // 获取对话列表
  const fetchConversations = async () => {
    if (!user) return;

    try {
      const data = await conversationsApi.getAll();
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      ArcoMessage.error('获取对话列表失败');
    }
  };

  // 创建新对话
  const createConversation = async (name: string): Promise<Conversation> => {
    const newConversation = await conversationsApi.create({ name });
    setConversations(prev => [newConversation, ...prev]);
    // 自动选中新创建的对话
    setCurrentConversation(newConversation);
    setMessages([]);
    return newConversation;
  };

  // 选择对话并加载消息
  const selectConversation = async (id: string) => {
    try {
      setLoading(true);
      const conversation = conversations.find(c => c.id === id);
      if (!conversation) {
        throw new Error('对话不存在');
      }

      setCurrentConversation(conversation);
      const msgs = await conversationsApi.getMessages(id);
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      ArcoMessage.error('加载对话失败');
    } finally {
      setLoading(false);
    }
  };

  // 发送消息并获取 AI 回复（流式）
  const sendMessage = async (content: string, roleId?: string, attachments?: any[]) => {
    if (!currentConversation) {
      ArcoMessage.error('请先选择一个对话');
      return;
    }

    console.log('[ConversationContext] sendMessage 被调用');
    console.log('[ConversationContext] content:', content);
    console.log('[ConversationContext] roleId:', roleId);
    console.log('[ConversationContext] attachments:', attachments);

    try {
      setLoading(true);
      let currentStreamingMessageId: string | null = null;

      // 使用流式 API
      conversationsApi.chatWithAIStream(
        currentConversation.id,
        { content, role_id: roleId, attachments },
        {
          onUserMessage: (message) => {
            // 添加用户消息
            console.log('[ConversationContext] onUserMessage 收到消息:', message);
            console.log('[ConversationContext] 消息是否有 attachments?', message.attachments);
            setMessages(prev => [...prev, message]);
          },
          onAIMessageStart: (messageId, role_id) => {
            // 开始流式接收 AI 消息
            currentStreamingMessageId = messageId;
            setStreamingMessageId(messageId);
            setStreamingContent('');

            // 添加临时消息占位符
            const tempMessage: Message = {
              id: messageId,
              conversation_id: currentConversation.id,
              role_id: role_id,
              content: '',
              position: 'left',
              created_at: Date.now(),
            };
            setMessages(prev => [...prev, tempMessage]);
          },
          onAIMessageChunk: (chunk) => {
            // 累积流式内容
            setStreamingContent(prev => {
              const newContent = prev + chunk;
              // 使用局部变量而不是 state 中的 streamingMessageId
              if (currentStreamingMessageId) {
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === currentStreamingMessageId
                      ? { ...msg, content: newContent }
                      : msg
                  )
                );
              }
              return newContent;
            });
          },
          onAIMessageComplete: (message) => {
            // 流式接收完成，替换为最终消息
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === message.id ? message : msg
              )
            );
            setStreamingMessageId(null);
            setStreamingContent('');
            setLoading(false);
            currentStreamingMessageId = null;

            // 更新对话列表
            fetchConversations();
          },
          onError: (error) => {
            ArcoMessage.error(error);
            setStreamingMessageId(null);
            setStreamingContent('');
            setLoading(false);
            currentStreamingMessageId = null;

            // 如果是 AI 配置问题，提示用户
            if (error.includes('配置')) {
              ArcoMessage.warning('请先在设置中配置 AI API');
            }
          },
        }
      );
    } catch (error: any) {
      console.error('Failed to send message:', error);
      ArcoMessage.error('发送消息失败');
      setLoading(false);
    }
  };

  // 删除对话
  const deleteConversation = async (id: string) => {
    try {
      await conversationsApi.delete(id);
      setConversations(prev => prev.filter(c => c.id !== id));

      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }

      ArcoMessage.success('对话删除成功');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      ArcoMessage.error('删除对话失败');
    }
  };

  // 删除消息
  const deleteMessage = async (messageId: string) => {
    try {
      await conversationsApi.deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  // 重新生成消息
  const regenerateMessage = async (messageId: string) => {
    try {
      setLoading(true);
      const response = await conversationsApi.regenerateMessage(messageId);

      // 删除原消息并添加新消息
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== messageId);
        return [...filtered, response.aiMessage];
      });
    } catch (error) {
      console.error('Failed to regenerate message:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 清空当前对话的所有消息
  const clearMessages = async () => {
    if (!currentConversation) {
      ArcoMessage.error('请先选择一个对话');
      return;
    }

    try {
      const result = await conversationsApi.clearMessages(currentConversation.id);
      setMessages([]);
      ArcoMessage.success(`已清空 ${result.deletedCount} 条消息`);
    } catch (error) {
      console.error('Failed to clear messages:', error);
      ArcoMessage.error('清空消息失败');
    }
  };

  // 用户登录后自动加载对话
  useEffect(() => {
    if (user) {
      fetchConversations();
    } else {
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
    }
  }, [user]);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        loading,
        isStreaming: !!streamingMessageId,
        fetchConversations,
        createConversation,
        selectConversation,
        sendMessage,
        deleteConversation,
        deleteMessage,
        regenerateMessage,
        clearMessages,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}
