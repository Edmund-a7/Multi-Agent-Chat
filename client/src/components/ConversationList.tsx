import { useState } from 'react';
import { List, Button, Input, Popconfirm, Empty, Message } from '@arco-design/web-react';
import { IconPlus, IconDelete, IconMessage, IconSearch, IconEdit } from '@arco-design/web-react/icon';
import type { Conversation } from '../types/conversation';
import './ConversationList.css';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
}

export default function ConversationList({
  conversations,
  currentConversationId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 过滤对话列表
  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 直接创建新对话
  const handleDirectCreate = async () => {
    const defaultName = '新对话 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    await onCreate(defaultName);
  };

  // 开始编辑
  const handleStartEdit = (e: React.MouseEvent, item: Conversation) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingName(item.name);
  };

  // 保存重命名
  const handleSaveRename = async (id: string) => {
    if (!editingName.trim()) {
      Message.error('名称不能为空');
      return;
    }
    if (onRename) {
      await onRename(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h3>对话列表</h3>
        <Button
          type="primary"
          icon={<IconPlus />}
          onClick={handleDirectCreate}
          size="small"
        >
          新建
        </Button>
      </div>

      {/* 搜索框 */}
      {conversations.length > 0 && (
        <div className="conversation-search">
          <Input
            prefix={<IconSearch />}
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={setSearchTerm}
            allowClear
          />
        </div>
      )}

      {filteredConversations.length === 0 ? (
        <div className="conversation-list-empty">
          <Empty description={searchTerm ? "没有找到匹配的对话" : "暂无对话"} />
        </div>
      ) : (
        <List
          className="conversation-items"
          dataSource={filteredConversations}
          render={(item: Conversation) => (
            <List.Item
              key={item.id}
              className={`conversation-item ${currentConversationId === item.id ? 'active' : ''}`}
              onClick={() => editingId !== item.id && onSelect(item.id)}
              actions={editingId === item.id ? [] : [
                <Button
                  key="edit"
                  type="text"
                  icon={<IconEdit />}
                  size="small"
                  onClick={(e: any) => handleStartEdit(e, item)}
                />,
                <Popconfirm
                  key="delete"
                  title="确认删除"
                  content={`确定要删除对话 "${item.name}" 吗？`}
                  onOk={(e) => {
                    e?.stopPropagation();
                    onDelete(item.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    icon={<IconDelete />}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              {editingId === item.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                  <Input
                    size="small"
                    value={editingName}
                    onChange={setEditingName}
                    onPressEnter={() => handleSaveRename(item.id)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <Button size="mini" type="primary" onClick={() => handleSaveRename(item.id)}>保存</Button>
                  <Button size="mini" onClick={handleCancelEdit}>取消</Button>
                </div>
              ) : (
                <List.Item.Meta
                  avatar={<IconMessage />}
                  title={item.name}
                  description={new Date(item.updated_at).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              )}
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

