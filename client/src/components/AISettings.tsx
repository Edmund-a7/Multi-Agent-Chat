import { useState, useEffect, useCallback } from 'react';
import { Form, Input, InputNumber, Button, Message, Card, Select, Space } from '@arco-design/web-react';
import { IconRefresh, IconEye, IconEyeInvisible } from '@arco-design/web-react/icon';
import api from '../services/api';
import './AISettings.css';

const FormItem = Form.Item;

interface ModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export default function AISettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);

  // 获取可用模型列表
  const fetchModels = useCallback(async (url?: string, silent = false) => {
    // 如果是事件触发（点击按钮），url 可能是 Event 对象，所以要检查类型
    const baseUrl = (typeof url === 'string' ? url : undefined) || form.getFieldValue('base_url');
    if (!baseUrl) {
      if (!silent) Message.warning('请先输入 API Base URL');
      return;
    }

    try {
      setLoadingModels(true);
      const response = await api.post('/ai-config/models', { base_url: baseUrl });
      if (response.data.models && response.data.models.length > 0) {
        setModels(response.data.models);
        if (!silent) Message.success(`获取到 ${response.data.models.length} 个可用模型`);
      } else {
        if (!silent) Message.warning('未找到可用模型');
      }
    } catch (error: any) {
      if (!silent) {
        Message.error(error.response?.data?.error || '获取模型列表失败');
      } else {
        console.error('Auto fetch models failed:', error);
      }
    } finally {
      setLoadingModels(false);
    }
  }, [form]);

  // 加载配置
  const fetchConfig = useCallback(async () => {
    try {
      setFetching(true);
      const response = await api.get('/ai-config');
      form.setFieldsValue({
        base_url: response.data.base_url,
        model: response.data.model,
        max_context_messages: response.data.max_context_messages,
      });
      setIsApiKeyConfigured(response.data.api_key_configured);
      if (response.data.api_key_configured) {
        setApiKeyValue('••••••••');

        // 如果配置了 API Key 和 Base URL，自动获取模型列表
        if (response.data.base_url) {
          setTimeout(() => fetchModels(response.data.base_url, true), 100);
        }
      }
    } catch (error) {
      Message.error('加载配置失败');
    } finally {
      setFetching(false);
    }
  }, [form, fetchModels]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue();

      // 如果 API key 是占位符，不发送
      if (apiKeyValue === '••••••••') {
        // 不更新 API key
        delete values.api_key;
      } else if (apiKeyValue) {
        values.api_key = apiKeyValue;
      } else {
        Message.error('请输入 API Key');
        return;
      }

      setLoading(true);
      await api.post('/ai-config', values);
      Message.success('AI 配置保存成功！');
      fetchConfig(); // 重新加载
    } catch (error: any) {
      if (error.response?.data?.error) {
        Message.error(error.response.data.error);
      } else {
        Message.error('保存失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="ai-settings" title="AI API 配置" loading={fetching}>
      <Form form={form} layout="vertical">
        <FormItem
          label="API Base URL"
          field="base_url"
          rules={[{ required: true, message: '请输入 API Base URL' }]}
        >
          <Input placeholder="https://api.openai.com/v1" />
        </FormItem>

        <FormItem
          label="API Key"
          required
        >
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKeyValue}
            onChange={setApiKeyValue}
            placeholder="sk-..."
            suffix={
              <Button
                type="text"
                size="mini"
                icon={showApiKey ? <IconEyeInvisible /> : <IconEye />}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ marginRight: -8 }}
              />
            }
          />
        </FormItem>

        <FormItem
          label="Model"
          field="model"
          rules={[{ required: true, message: '请选择或输入 Model 名称' }]}
        >
          <Space style={{ width: '100%' }}>
            <Select
              style={{ flex: 1 }}
              placeholder="选择模型或手动输入"
              showSearch
              allowCreate
              loading={loadingModels}
              options={models.map(m => ({ label: m.id, value: m.id }))}
              onChange={(value) => form.setFieldValue('model', value)}
              value={form.getFieldValue('model')}
              notFoundContent={models.length === 0 ? '点击刷新按钮获取模型列表' : '无匹配结果'}
            />
            <Button
              icon={<IconRefresh />}
              onClick={() => fetchModels()}
              loading={loadingModels}
              title="获取可用模型列表"
            />
          </Space>
        </FormItem>

        <FormItem
          label="上下文消息数量"
          field="max_context_messages"
          rules={[{ required: true, message: '请输入上下文消息数量' }]}
        >
          <InputNumber min={1} max={50} defaultValue={10} />
        </FormItem>

        <FormItem>
          <Button type="primary" onClick={handleSubmit} loading={loading} long>
            保存配置
          </Button>
        </FormItem>
      </Form>

      <div className="ai-settings-tips">
        <h4>提示：</h4>
        <ul>
          <li>支持 OpenAI 及所有兼容 OpenAI API 格式的服务</li>
          <li>API Base URL 示例: https://api.openai.com/v1</li>
          <li>点击刷新按钮可自动获取可用模型列表</li>
          <li>上下文消息数量：AI 能看到的历史消息条数</li>
        </ul>
      </div>
    </Card>
  );
}
