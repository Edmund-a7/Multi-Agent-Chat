import { useState, useRef } from 'react';
import { Input, Button, Dropdown, Menu, Tag } from '@arco-design/web-react';
import { IconSend, IconAttachment } from '@arco-design/web-react/icon';
import { useRoles } from '../contexts/RolesContext';
import { shouldShowMentionSuggestions } from '../utils/mentionParser';
import type { Role } from '../types/role';
import { uploadApi, type Attachment } from '../services/uploadApi';
import './MessageInput.css';

interface MessageInputProps {
  onSend: (content: string, roleId?: string, attachments?: Attachment[]) => void;
  onCommand?: (command: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, onCommand, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [commandSearchText, setCommandSearchText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { roles } = useRoles();

  // 快捷命令列表
  const commands = [
    { key: '/clear', description: '清空当前对话', icon: '🗑️' },
    { key: '/export', description: '导出对话记录', icon: '📤' },
    { key: '/help', description: '显示快捷键帮助', icon: '❓' },
    { key: '/new', description: '创建新对话', icon: '➕' },
  ];

  // 监听输入变化，检测 @ 符号和 / 命令
  const handleContentChange = (value: string) => {
    setContent(value);

    // 获取光标位置
    const textarea = textareaRef.current?.dom;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      setCursorPosition(cursorPos);

      // 检查是否应该显示角色选择器
      const suggestion = shouldShowMentionSuggestions(value, cursorPos);
      setShowRoleSelector(suggestion.show);
      setSearchText(suggestion.searchText);

      // 检查是否输入了 / 命令
      if (value.startsWith('/')) {
        setShowCommandMenu(true);
        setCommandSearchText(value.slice(1).toLowerCase());
      } else {
        setShowCommandMenu(false);
      }
    }
  };

  // 过滤匹配的角色
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 过滤匹配的命令
  const filteredCommands = commands.filter(cmd =>
    cmd.key.slice(1).includes(commandSearchText)
  );

  // 执行命令
  const handleExecuteCommand = (command: string) => {
    setContent('');
    setShowCommandMenu(false);
    if (onCommand) {
      onCommand(command);
    }
  };

  // 选择角色
  const handleSelectRole = (role: Role) => {
    const textarea = textareaRef.current?.dom;
    if (!textarea) return;

    // 找到最后一个 @ 符号的位置
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    // 替换 @xxx 为 @RoleName
    const newContent =
      content.substring(0, lastAtIndex + 1) +
      role.name +
      ' ' +
      content.substring(cursorPosition);

    setContent(newContent);
    setSelectedRoleId(role.id);
    setShowRoleSelector(false);

    // 设置光标位置到角色名后面
    setTimeout(() => {
      const newCursorPos = lastAtIndex + 1 + role.name.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // 处理文件上传
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadApi.uploadFile(file);
        setAttachments(prev => [...prev, attachment]);
      }
    } catch (error: any) {
      alert('文件上传失败: ' + (error.message || '未知错误'));
    } finally {
      setUploading(false);
      // 清空 input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 移除附件
  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSend = () => {
    if (!content.trim() && attachments.length === 0) return;

    // 解析消息中的 @mentions，提取最后一个提及的角色
    const mentionRegex = /@(\w+)/g;
    const matches = [...content.matchAll(mentionRegex)];
    let finalRoleId = selectedRoleId;

    if (matches.length > 0) {
      const lastMentionName = matches[matches.length - 1][1];
      const mentionedRole = roles.find(
        r => r.name.toLowerCase() === lastMentionName.toLowerCase()
      );
      if (mentionedRole) {
        finalRoleId = mentionedRole.id;
      }
    }

    const attachmentsToSend = attachments.length > 0 ? attachments : undefined;

    onSend(content || '发送了文件', finalRoleId, attachmentsToSend);
    setContent('');
    setAttachments([]);
    setSelectedRoleId(undefined);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // 如果输入以 / 开头，处理命令
    if (content.startsWith('/') && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 查找精确匹配的命令
      const exactCommand = commands.find(cmd => cmd.key === content.trim());
      if (exactCommand) {
        handleExecuteCommand(exactCommand.key);
        return;
      }
      // 如果没有精确匹配，使用第一个过滤结果
      if (filteredCommands.length > 0) {
        handleExecuteCommand(filteredCommands[0].key);
        return;
      }
      // 没有匹配的命令
      return;
    }

    // 如果命令菜单显示，处理 Escape
    if (showCommandMenu && e.key === 'Escape') {
      setShowCommandMenu(false);
      setContent('');
      return;
    }

    // 如果角色选择器显示，屏蔽 Enter
    if (showRoleSelector && filteredRoles.length > 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectRole(filteredRoles[0]);
        return;
      }
      if (e.key === 'Escape') {
        setShowRoleSelector(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 渲染命令菜单
  const commandMenu = (
    <Menu>
      {filteredCommands.length > 0 ? (
        filteredCommands.map(cmd => (
          <Menu.Item
            key={cmd.key}
            onClick={() => handleExecuteCommand(cmd.key)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{cmd.icon}</span>
              <span style={{ fontWeight: 500 }}>{cmd.key}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{cmd.description}</span>
            </div>
          </Menu.Item>
        ))
      ) : (
        <Menu.Item key="no-match" disabled>没有匹配的命令</Menu.Item>
      )}
    </Menu>
  );

  // 渲染角色选择菜单
  const roleMenu = (
    <Menu>
      {filteredRoles.length > 0 ? (
        filteredRoles.map(role => (
          <Menu.Item
            key={role.id}
            onClick={() => handleSelectRole(role)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: role.color,
                }}
              />
              <span>{role.name}</span>
            </div>
          </Menu.Item>
        ))
      ) : (
        <Menu.Item key="no-match" disabled>没有匹配的角色</Menu.Item>
      )}
    </Menu>
  );

  return (
    <div className="message-input-container">
      {/* 附件预览 */}
      {attachments.length > 0 && (
        <div className="attachments-preview">
          {attachments.map(att => (
            <Tag
              key={att.id}
              closable
              onClose={() => handleRemoveAttachment(att.id)}
              color="arcoblue"
            >
              {att.file_type === 'image' ? '🖼️' : '📄'} {att.file_name} ({formatFileSize(att.file_size)})
            </Tag>
          ))}
        </div>
      )}

      <div className="message-input">
        {/* 文件上传按钮 */}
        <Button
          type="text"
          icon={<IconAttachment />}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          loading={uploading}
          title="上传文件"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <Dropdown
          droplist={showCommandMenu ? commandMenu : roleMenu}
          trigger="focus"
          position="top"
          popupVisible={showRoleSelector || showCommandMenu}
          onVisibleChange={(visible) => {
            // 只有当菜单关闭时才重置状态
            // 但如果正在输入命令则不关闭
            if (!visible && !content.startsWith('/')) {
              setShowRoleSelector(false);
              setShowCommandMenu(false);
            }
          }}
        >
          <Input.TextArea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyPress}
            placeholder="输入消息... (输入 @ 提及角色，输入 / 查看命令，Enter 发送)"
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={disabled}
          />
        </Dropdown>
        <Button
          type="primary"
          icon={<IconSend />}
          onClick={handleSend}
          disabled={disabled || (!content.trim() && attachments.length === 0) || uploading}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
