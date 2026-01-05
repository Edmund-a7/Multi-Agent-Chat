import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Message, Card, Tabs } from '@arco-design/web-react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const FormItem = Form.Item;
const TabPane = Tabs.TabPane;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      Message.success('登录成功！');
      navigate('/chat');
    } catch (error: any) {
      Message.error(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { username: string; password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      Message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(values.username, values.password);
      Message.success('注册成功！');
      navigate('/chat');
    } catch (error: any) {
      Message.error(error.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <h1 className="login-title">Multi-Agent Chat</h1>
        <p className="login-subtitle">支持多角色对话的智能聊天系统</p>

        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="login" title="登录">
            <Form onSubmit={handleLogin} layout="vertical">
              <FormItem
                label="用户名"
                field="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { minLength: 3, message: '用户名至少需要3个字符' },
                ]}
              >
                <Input placeholder="请输入用户名" />
              </FormItem>

              <FormItem
                label="密码"
                field="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { minLength: 6, message: '密码至少需要6个字符' },
                ]}
              >
                <Input.Password placeholder="请输入密码" />
              </FormItem>

              <FormItem>
                <Button type="primary" htmlType="submit" long loading={loading}>
                  登录
                </Button>
              </FormItem>
            </Form>
          </TabPane>

          <TabPane key="register" title="注册">
            <Form onSubmit={handleRegister} layout="vertical">
              <FormItem
                label="用户名"
                field="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { minLength: 3, message: '用户名至少需要3个字符' },
                ]}
              >
                <Input placeholder="请输入用户名" />
              </FormItem>

              <FormItem
                label="密码"
                field="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { minLength: 6, message: '密码至少需要6个字符' },
                ]}
              >
                <Input.Password placeholder="请输入密码" />
              </FormItem>

              <FormItem
                label="确认密码"
                field="confirmPassword"
                rules={[{ required: true, message: '请再次输入密码' }]}
              >
                <Input.Password placeholder="请再次输入密码" />
              </FormItem>

              <FormItem>
                <Button type="primary" htmlType="submit" long loading={loading}>
                  注册
                </Button>
              </FormItem>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
