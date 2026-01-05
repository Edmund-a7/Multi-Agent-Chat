import { useState, useEffect } from 'react';
import { Button, Space, Empty, Message } from '@arco-design/web-react';
import { IconSettings, IconMoonFill, IconSunFill, IconMenu, IconExport, IconRobot, IconMessage, IconMindMapping } from '@arco-design/web-react/icon';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useConversation } from '../contexts/ConversationContext';
import { useNavigate } from 'react-router-dom';
import ConversationList from '../components/ConversationList';
import ConversationStats from '../components/ConversationStats';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';
import { exportConversation } from '../utils/exportConversation';
import WorkflowList from '../components/WorkflowList';
import WorkflowEditor from '../components/WorkflowEditor';
import WorkflowRunner from '../components/WorkflowRunner';
import WorkflowHistory from '../components/WorkflowHistory';
import { type Workflow, type WorkflowRun, WorkflowService } from '../services/WorkflowService';
import './Chat.css';

export default function Chat() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const {
    conversations,
    currentConversation,
    messages,
    loading,
    isStreaming,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    deleteMessage,
    regenerateMessage,
    clearMessages,
  } = useConversation();

  // 移动端侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // 工作流相关状态
  const [sidebarView, setSidebarView] = useState<'chat' | 'workflow'>('chat');
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [workflowMode, setWorkflowMode] = useState<'run' | 'edit' | 'create' | 'history' | 'run_history'>('run');
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: 新建对话
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateConversation('新对话 ' + new Date().toLocaleTimeString());
      }
      // Cmd/Ctrl + K: 切换侧边栏
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
      // ?: 显示快捷键帮助
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }
      // Escape: 关闭侧边栏和弹窗
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setShowShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateConversation = async (name: string) => {
    const conversation = await createConversation(name);
    await selectConversation(conversation.id);
    setSidebarView('chat');
    setSidebarOpen(false);
  };

  const handleRenameConversation = async (id: string, newName: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/conversations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: newName })
    });
    if (response.ok) {
      // Refresh to update the list
      window.location.reload();
    }
  };

  const handleSendMessage = async (content: string, roleId?: string, attachments?: any[]) => {
    await sendMessage(content, roleId, attachments);
  };

  const handleExport = (format: 'markdown' | 'json') => {
    if (!currentConversation || messages.length === 0) {
      Message.warning('没有消息可以导出');
      return;
    }

    try {
      exportConversation(currentConversation.name, messages, format);
      Message.success(`导出成功！格式: ${format.toUpperCase()}`);
    } catch (error) {
      Message.error('导出失败，请重试');
      console.error('Export error:', error);
    }
  };

  // 工作流相关处理函数
  const handleWorkflowSelect = async (workflow: Workflow) => {
    setActiveWorkflow(workflow);
    setWorkflowMode('run');
    setSelectedRun(null); // 清空历史，显示新运行输入界面
    setSidebarView('workflow');

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleWorkflowEdit = async (workflow: Workflow) => {
    try {
      // Fetch full details including steps
      const fullWorkflow = await WorkflowService.getById(workflow.id);
      setActiveWorkflow(fullWorkflow);
      setWorkflowMode('edit');
      setSidebarView('workflow');
    } catch (error) {
      Message.error('无法加载工作流详情');
    }
  };

  const handleWorkflowCreate = () => {
    setActiveWorkflow(null);
    setWorkflowMode('create');
    setSidebarView('workflow');
  };



  const handleWorkflowSave = (savedWorkflow?: Workflow) => {
    setWorkflowMode('run');
    setRefreshTrigger(prev => prev + 1); // Trigger list refresh
    if (savedWorkflow) {
      setActiveWorkflow(savedWorkflow);
    } else if (workflowMode === 'create') {
      setActiveWorkflow(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
      Message.success('消息已删除');
    } catch (error) {
      Message.error('删除失败，请重试');
      console.error('Delete message error:', error);
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    try {
      await regenerateMessage(messageId);
      Message.success('已重新生成回复');
    } catch (error) {
      Message.error('重新生成失败，请重试');
      console.error('Regenerate message error:', error);
    }
  };

  // 处理快捷命令
  const handleCommand = (command: string) => {
    switch (command) {
      case '/clear':
        if (currentConversation && messages.length > 0) {
          clearMessages();
        } else {
          Message.info('当前对话没有消息');
        }
        break;
      case '/export':
        handleExport('markdown');
        break;
      case '/new':
        handleCreateConversation('新对话 ' + new Date().toLocaleTimeString());
        break;
      case '/help':
        setShowShortcuts(true);
        break;
      default:
        Message.warning('未知命令: ' + command);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 顶部导航栏 */}
        <div className="chat-navbar">
          <div className="chat-navbar-left">
            <Button
              className="mobile-menu-btn"
              type="text"
              icon={<IconMenu />}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            />
            <div className="chat-logo">
              <div className="chat-logo-icon">
                <IconRobot />
              </div>
              <span className="chat-logo-text">Multi-Agent Chat</span>
            </div>
          </div>
          <Space size="medium">
            <Button
              onClick={toggleTheme}
              type="text"
              icon={theme === 'dark' ? <IconSunFill /> : <IconMoonFill />}
              title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
              className="navbar-icon-btn"
            />
            <Button
              onClick={() => navigate('/settings')}
              type="text"
              icon={<IconSettings />}
              title="设置"
              className="navbar-icon-btn"
            />
            <Button
              onClick={handleLogout}
              type="text"
              icon={<IconExport />}
              title="退出登录"
              className="navbar-icon-btn"
            />
          </Space>
        </div>

        {/* 主体区域 */}
        <div className="chat-main">
          {/* 移动端遮罩层 */}
          <div
            className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* 左侧对话列表 */}
          <div className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-2)' }}>
              <div
                className={`sidebar-tab ${sidebarView === 'chat' ? 'active' : ''}`}
                onClick={() => setSidebarView('chat')}
                style={{ flex: 1, textAlign: 'center', padding: '12px', cursor: 'pointer', borderBottom: sidebarView === 'chat' ? '2px solid var(--primary-6)' : 'none' }}
              >
                <Space><IconMessage /> 对话</Space>
              </div>
              <div
                className={`sidebar-tab ${sidebarView === 'workflow' ? 'active' : ''}`}
                onClick={() => setSidebarView('workflow')}
                style={{ flex: 1, textAlign: 'center', padding: '12px', cursor: 'pointer', borderBottom: sidebarView === 'workflow' ? '2px solid var(--primary-6)' : 'none' }}
              >
                <Space><IconMindMapping /> 工作流</Space>
              </div>
            </div>

            <div className="sidebar-content" style={{ flex: 1, overflow: 'hidden' }}>
              {sidebarView === 'chat' ? (
                <ConversationList
                  conversations={conversations}
                  currentConversationId={currentConversation?.id}
                  onSelect={(id) => {
                    selectConversation(id);
                    setSidebarOpen(false);
                  }}
                  onCreate={handleCreateConversation}
                  onDelete={deleteConversation}
                  onRename={handleRenameConversation}
                />
              ) : (
                <WorkflowList
                  onSelect={handleWorkflowSelect}
                  onEdit={handleWorkflowEdit}
                  onCreate={handleWorkflowCreate}
                  onViewHistory={() => {
                    setActiveWorkflow(null);
                    setWorkflowMode('history');
                  }}
                  selectedId={activeWorkflow?.id}
                  refreshTrigger={refreshTrigger}
                  onDelete={(id) => {
                    if (activeWorkflow?.id === id) {
                      setActiveWorkflow(null);
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* 右侧聊天区域 */}
          <div className="chat-content-area">
            {sidebarView === 'workflow' ? (
              // 工作流视图
              workflowMode === 'history' ? (
                <WorkflowHistory
                  onSelectRun={(run) => {
                    // Fetch full workflow details for the runner
                    WorkflowService.getById(run.workflow_id).then(wf => {
                      setActiveWorkflow(wf);
                      setSelectedRun(run);
                      setWorkflowMode('run_history');
                    }).catch(() => {
                      Message.error('无法加载工作流详情');
                    });
                  }}
                  onBack={() => {
                    setWorkflowMode('run'); // Go back to default/empty state or list
                    setActiveWorkflow(null);
                  }}
                />
              ) : activeWorkflow || workflowMode === 'create' ? (
                workflowMode === 'run_history' && activeWorkflow && selectedRun ? (
                  <WorkflowRunner
                    workflow={activeWorkflow}
                    initialRun={selectedRun}
                    onBack={() => {
                      setWorkflowMode('history');
                      setSelectedRun(null);
                      setActiveWorkflow(null);
                    }}
                  />
                ) : workflowMode === 'run' && activeWorkflow ? (
                  <WorkflowRunner
                    workflow={activeWorkflow}
                    initialRun={selectedRun}
                    onBack={() => {
                      setActiveWorkflow(null);
                      setSelectedRun(null);
                    }}
                  />
                ) : (
                  <WorkflowEditor
                    workflow={activeWorkflow || undefined}
                    onSave={handleWorkflowSave}
                    onCancel={() => {
                      setWorkflowMode('run');
                      if (workflowMode === 'create') setActiveWorkflow(null);
                    }}
                  />
                )
              ) : (
                <div className="chat-empty">
                  <Empty description="请选择一个工作流或创建新工作流" />
                </div>
              )
            ) : (
              // 对话视图
              currentConversation ? (
                <>
                  <ConversationStats
                    conversationId={currentConversation.id}
                    onExport={handleExport}
                    key={messages.length}
                  />
                  <MessageList
                    messages={messages}
                    onDeleteMessage={handleDeleteMessage}
                    onRegenerateMessage={handleRegenerateMessage}
                    isStreaming={isStreaming}
                  />
                  <MessageInput onSend={handleSendMessage} onCommand={handleCommand} disabled={loading || isStreaming} />
                </>
              ) : (
                <div className="chat-empty">
                  <Empty
                    description={
                      <div>
                        <p>请选择或创建一个对话开始聊天</p>
                        <p style={{ fontSize: 12, color: '#86909c', marginTop: 8 }}>
                          提示：输入 @ 提及角色，输入 / 显示命令，按 ? 查看快捷键
                        </p>
                      </div>
                    }
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 键盘快捷键帮助 */}
      <KeyboardShortcutsModal
        visible={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
