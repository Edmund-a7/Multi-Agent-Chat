// Conversation type
export type Conversation = {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

// Attachment type
export type Attachment = {
  id: string;
  file_name: string;
  file_type: 'image' | 'document';
  file_size: number;
  mime_type: string;
  extracted_text?: string | null;
  created_at?: number;
}

// Message type
export type Message = {
  id: string;
  conversation_id: string;
  role_id: string | null;
  content: string;
  position: 'left' | 'right'; // left=AI, right=user
  created_at: number;
  attachments?: Attachment[];
}

// Create conversation request
export type ConversationInput = {
  name: string;
}

// Create message request
export type MessageInput = {
  content: string;
  role_id?: string;
  attachments?: Attachment[];
}
