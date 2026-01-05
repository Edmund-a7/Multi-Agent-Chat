import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@arco-design/web-react';
import { IconLeft } from '@arco-design/web-react/icon';
import AISettings from '../components/AISettings';
import RoleManager from '../components/RoleManager';
import { useAuth } from '../contexts/AuthContext';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="settings-container">
      <Card className="settings-card">
        <div className="settings-header">
          <div className="settings-header-left">
            <Button
              icon={<IconLeft />}
              onClick={() => navigate('/chat')}
              type="text"
            >
              返回聊天
            </Button>
            <h2>设置</h2>
          </div>
          <div className="settings-header-right">
            <span className="user-info">当前用户: {user?.username}</span>
            <Button onClick={handleLogout} type="outline">
              退出登录
            </Button>
          </div>
        </div>

        <div className="settings-content">
          <AISettings />
          <RoleManager />
        </div>
      </Card>
    </div>
  );
}
