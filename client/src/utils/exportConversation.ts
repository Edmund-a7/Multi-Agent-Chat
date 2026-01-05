import type { Message } from '../types/conversation';

/**
 * 导出对话为 Markdown 格式
 */
export function exportToMarkdown(
  conversationName: string,
  messages: Message[]
): string {
  const header = `# ${conversationName}\n\n导出时间: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;

  const content = messages
    .map((msg) => {
      const timestamp = new Date(msg.created_at).toLocaleString('zh-CN');
      const sender = msg.position === 'right' ? '**用户**' : '**AI**';
      return `### ${sender} - ${timestamp}\n\n${msg.content}\n`;
    })
    .join('\n---\n\n');

  return header + content;
}

/**
 * 导出对话为 JSON 格式
 */
export function exportToJSON(
  conversationName: string,
  messages: Message[]
): string {
  const data = {
    conversation: conversationName,
    exportTime: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender: msg.position === 'right' ? 'user' : 'ai',
      role_id: msg.role_id,
      timestamp: msg.created_at,
    })),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * 下载文件
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出对话
 */
export function exportConversation(
  conversationName: string,
  messages: Message[],
  format: 'markdown' | 'json' = 'markdown'
): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = conversationName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');

  if (format === 'markdown') {
    const content = exportToMarkdown(conversationName, messages);
    const filename = `${safeName}_${timestamp}.md`;
    downloadFile(content, filename, 'text/markdown;charset=utf-8');
  } else {
    const content = exportToJSON(conversationName, messages);
    const filename = `${safeName}_${timestamp}.json`;
    downloadFile(content, filename, 'application/json;charset=utf-8');
  }
}
