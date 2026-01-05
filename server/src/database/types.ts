// 数据库类型定义
export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

export interface Role {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string;
  color: string;
  model?: string;
  created_at: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role_id: string | null;
  content: string;
  position: 'left' | 'right';
  created_at: number;
}

export interface AIConfig {
  id: string;
  user_id: string;
  base_url: string;
  api_key: string;
  model: string;
  max_context_messages: number;
}
