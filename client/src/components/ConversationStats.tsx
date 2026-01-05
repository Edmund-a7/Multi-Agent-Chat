import { useState, useEffect } from 'react';
import { Tag, Space, Tooltip, Dropdown, Menu, Button } from '@arco-design/web-react';
import { IconMessage, IconUser, IconRobot, IconDownload } from '@arco-design/web-react/icon';
import api from '../services/api';
import './ConversationStats.css';

interface ConversationStatsProps {
  conversationId: string | null;
  onExport?: (format: 'markdown' | 'json') => void;
}

interface Stats {
  totalMessages: number;
  userMessages: number;
  aiMessages: number;
}

export default function ConversationStats({ conversationId, onExport }: ConversationStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setStats(null);
      return;
    }

    fetchStats();
  }, [conversationId]);

  const fetchStats = async () => {
    try {
      const response = await api.get(`/chat/stats/${conversationId}`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const exportMenu = (
    <Menu>
      <Menu.Item key="markdown" onClick={() => onExport?.('markdown')}>
        导出为 Markdown
      </Menu.Item>
      <Menu.Item key="json" onClick={() => onExport?.('json')}>
        导出为 JSON
      </Menu.Item>
    </Menu>
  );

  if (!stats || stats.totalMessages === 0) {
    return null;
  }

  return (
    <div className="conversation-stats">
      <Space size="medium">
        <Tooltip content="总消息数">
          <Tag icon={<IconMessage />} color="blue">
            {stats.totalMessages} 条消息
          </Tag>
        </Tooltip>

        <Tooltip content="用户消息">
          <Tag icon={<IconUser />} color="green">
            {stats.userMessages} 条
          </Tag>
        </Tooltip>

        <Tooltip content="AI 回复">
          <Tag icon={<IconRobot />} color="purple">
            {stats.aiMessages} 条
          </Tag>
        </Tooltip>

        {onExport && (
          <Dropdown droplist={exportMenu} trigger="click" position="br">
            <Button size="small" icon={<IconDownload />} type="text">
              导出
            </Button>
          </Dropdown>
        )}
      </Space>
    </div>
  );
}
