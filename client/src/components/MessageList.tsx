import { useEffect, useRef, useState, useMemo, memo } from 'react';
import { Empty, Message as ArcoMessage, Popconfirm, Tooltip, Tag, Collapse } from '@arco-design/web-react';
import { IconCopy, IconDelete, IconRefresh, IconDownload, IconFile, IconBulb } from '@arco-design/web-react/icon';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../types/conversation';
import { useRoles } from '../contexts/RolesContext';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  isStreaming?: boolean;
}

function MessageList({ messages, onDeleteMessage, onRegenerateMessage, isStreaming }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { roles } = useRoles();
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // 缓存角色映射表以优化查找性能
  const rolesMap = useMemo(() => {
    const map = new Map<string, typeof roles[0]>();
    roles.forEach(role => map.set(role.id, role));
    return map;
  }, [roles]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 获取角色信息 (使用缓存的 Map)
  const getRoleInfo = (roleId: string | null) => {
    if (!roleId) return null;
    return rolesMap.get(roleId) || null;
  };

  // 复制消息内容
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      ArcoMessage.success('已复制到剪贴板');
    } catch (error) {
      ArcoMessage.error('复制失败');
    }
  };

  // 删除消息
  const handleDelete = (messageId: string) => {
    if (onDeleteMessage) {
      onDeleteMessage(messageId);
    }
  };

  // 重新生成消息
  const handleRegenerate = (messageId: string) => {
    if (onRegenerateMessage) {
      onRegenerateMessage(messageId);
    }
  };

  // 解析消息内容，分离思考过程和实际内容
  const parseMessageContent = (content: string): { reasoning: string; main: string } => {
    if (!content) return { reasoning: '', main: '' };

    // 收集所有思考内容
    let reasoning = '';
    let main = content;

    // 匹配完整的 [REASONING]...[/REASONING] 标记
    const fullMatches = content.matchAll(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/gi);
    for (const match of fullMatches) {
      reasoning += match[1];
      main = main.replace(match[0], '');
    }

    // 处理可能未闭合的 [REASONING] 标记（清理开始标签及其后的内容）
    if (main.includes('[REASONING]')) {
      const idx = main.indexOf('[REASONING]');
      const endIdx = main.indexOf('[/REASONING]', idx);
      if (endIdx === -1) {
        // 未闭合的情况，移除 [REASONING] 及其后面的所有内容
        main = main.substring(0, idx);
      }
    }

    return { reasoning: reasoning.trim(), main: main.trim() };
  };

  if (messages.length === 0) {
    return (
      <div className="message-list-empty">
        <Empty description="暂无消息，开始聊天吧！" />
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message, index) => {
        const role = getRoleInfo(message.role_id);
        const isUser = message.position === 'right';
        const isLastAiMessage = !isUser && index === messages.length - 1;
        const isStreamingMessage = isStreaming && isLastAiMessage;

        // 解析消息内容，分离思考过程
        const { reasoning, main } = parseMessageContent(message.content);

        return (
          <div
            key={message.id}
            className={`message-item ${isUser ? 'message-user' : 'message-ai'}`}
            onMouseEnter={() => setHoveredMessageId(message.id)}
            onMouseLeave={() => setHoveredMessageId(null)}
          >
            {!isUser && role && (
              <div className="message-role-badge">
                <span
                  className="role-color-indicator"
                  style={{ backgroundColor: role.color }}
                />
                <span className="role-name">{role.name}</span>
              </div>
            )}

            {/* 思考过程折叠区域 */}
            {!isUser && reasoning && (
              <Collapse
                bordered={false}
                className="reasoning-collapse"
                defaultActiveKey={[]}
              >
                <Collapse.Item
                  header={
                    <div className="reasoning-header">
                      <IconBulb style={{ marginRight: 6 }} />
                      <span>思考过程</span>
                    </div>
                  }
                  name="reasoning"
                >
                  <div className="reasoning-content">
                    {reasoning}
                  </div>
                </Collapse.Item>
              </Collapse>
            )}

            <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'} ${isStreamingMessage ? 'message-streaming' : ''}`}>
              <div className="message-content">
                <ReactMarkdown
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      const isInline = !match && !codeString.includes('\n');

                      return !isInline && match ? (
                        <div className="code-block-wrapper">
                          <div className="code-block-header">
                            <span className="code-language">{match[1]}</span>
                            <button
                              className="code-copy-btn"
                              onClick={() => handleCopy(codeString)}
                            >
                              <IconCopy /> 复制
                            </button>
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              borderRadius: '0 0 8px 8px',
                              fontSize: '13px',
                            }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    },
                    img({ node, className, children, src, alt, ...props }) {
                      let imageSrc = src;
                      // 如果是内部上传接口的图片，自动附加 token
                      if (src && (src.includes('/api/upload/') || src.startsWith('http://localhost:3000/api/upload/'))) {
                        const token = localStorage.getItem('token');
                        if (token && !src.includes('token=')) {
                          const separator = src.includes('?') ? '&' : '?';
                          imageSrc = `${src}${separator}token=${token}`;
                        }
                      }

                      return (
                        <div className="message-image-wrapper">
                          <img
                            src={imageSrc}
                            alt={alt}
                            className="message-markdown-image"
                            loading="lazy"
                            onClick={() => imageSrc && window.open(imageSrc, '_blank')}
                            {...props}
                          />
                        </div>
                      );
                    }
                  }}
                >
                  {main || (reasoning ? '' : message.content)}
                </ReactMarkdown>
                {isStreamingMessage && <span className="streaming-cursor" />}
              </div>

              {/* 附件显示 */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="message-attachments">
                  {message.attachments.map(att => {
                    if (att.file_type === 'image') {
                      // 图片预览 - 直接使用 img 标签
                      const token = localStorage.getItem('token');
                      const imageUrl = `http://localhost:3000/api/upload/${att.id}?token=${token}`;
                      return (
                        <div key={att.id} className="attachment-image">
                          <img
                            src={imageUrl}
                            alt={att.file_name}
                            loading="lazy"
                            style={{
                              maxWidth: '300px',
                              maxHeight: '300px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              objectFit: 'contain',
                              display: 'block'
                            }}
                            onClick={() => window.open(imageUrl, '_blank')}
                          />
                          <span className="attachment-name">{att.file_name}</span>
                        </div>
                      );
                    } else {
                      // 文档下载链接
                      return (
                        <Tag
                          key={att.id}
                          icon={<IconFile />}
                          color="arcoblue"
                          style={{ cursor: 'pointer' }}
                          onClick={() => window.open(`http://localhost:3000/api/upload/${att.id}`, '_blank')}
                        >
                          <IconDownload style={{ marginRight: 4 }} />
                          {att.file_name}
                        </Tag>
                      );
                    }
                  })}
                </div>
              )}

              <div className="message-footer">
                <div className="message-time">
                  {new Date(message.created_at).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {hoveredMessageId === message.id && !isStreamingMessage && (
                  <div className="message-actions">
                    <Tooltip content="复制">
                      <button
                        className="message-action-btn"
                        onClick={() => handleCopy(message.content)}
                      >
                        <IconCopy />
                      </button>
                    </Tooltip>
                    {isLastAiMessage && onRegenerateMessage && (
                      <Tooltip content="重新生成">
                        <button
                          className="message-action-btn"
                          onClick={() => handleRegenerate(message.id)}
                        >
                          <IconRefresh />
                        </button>
                      </Tooltip>
                    )}
                    {onDeleteMessage && (
                      <Popconfirm
                        title="确认删除"
                        content="确定要删除这条消息吗？"
                        onOk={() => handleDelete(message.id)}
                        okText="删除"
                        cancelText="取消"
                      >
                        <Tooltip content="删除">
                          <button className="message-action-btn message-action-delete">
                            <IconDelete />
                          </button>
                        </Tooltip>
                      </Popconfirm>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div >
  );
}

export default memo(MessageList);
