import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Message, Popconfirm, Tag, Space, Select } from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete, IconRefresh } from '@arco-design/web-react/icon';
import type { Role, RoleInput } from '../types/role';
import { useRoles } from '../contexts/RolesContext';
import api from '../services/api';
import './RoleManager.css';

const FormItem = Form.Item;
const TextArea = Input.TextArea;

interface ModelInfo {
  id: string;
}

export default function RoleManager() {
  const { roles, loading, createRole, updateRole, deleteRole } = useRoles();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Model state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [config, setConfig] = useState<{ base_url?: string, api_key_configured?: boolean }>({});

  useEffect(() => {
    // 组件加载时获取 AI 配置，以便后续获取模型列表
    api.get('/ai-config').then(res => {
      setConfig(res.data);
    }).catch(() => { }); // 忽略错误
  }, []);

  const fetchModels = async () => {
    try {
      if (!config.base_url) {
        // 尝试重新获取配置
        const configRes = await api.get('/ai-config');
        setConfig(configRes.data);
        if (!configRes.data.base_url) {
          Message.warning('请先在 AI API 配置中设置 Base URL');
          return;
        }
      }

      setLoadingModels(true);
      // 使用已保存的配置获取模型，不需要传 api_key (后端会处理)
      const response = await api.post('/ai-config/models', {
        base_url: config.base_url
      });

      if (response.data.models && response.data.models.length > 0) {
        setModels(response.data.models);
        Message.success('模型列表已更新');
      } else {
        Message.warning('未找到可用模型');
      }
    } catch (error: any) {
      Message.error(error.response?.data?.error || '获取模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  };

  // 打开创建/编辑对话框
  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      form.setFieldsValue({
        name: role.name,
        system_prompt: role.system_prompt,
        color: role.color,
        model: role.model,
      });
    } else {
      setEditingRole(null);
      form.resetFields();
    }
    setModalVisible(true);
    // 打开模态框时尝试获取模型列表（如果还没获取过）
    if (models.length === 0) {
      fetchModels();
    }
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingRole(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue() as RoleInput;

      setSubmitting(true);

      if (editingRole) {
        await updateRole(editingRole.id, values);
        Message.success('角色更新成功');
      } else {
        await createRole(values);
        Message.success('角色创建成功');
      }

      handleCloseModal();
    } catch (error: any) {
      if (error.response?.data?.error) {
        Message.error(error.response.data.error);
      } else if (error.errors) {
        // 表单验证错误
        return;
      } else {
        Message.error('操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 删除角色
  const handleDelete = async (role: Role) => {
    try {
      await deleteRole(role.id);
      Message.success('角色删除成功');
    } catch (error: any) {
      Message.error(error.response?.data?.error || '删除失败');
    }
  };

  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      render: (name: string, record: Role) => (
        <Space>
          <Tag color={record.color}>{name}</Tag>
        </Space>
      ),
    },
    {
      title: '系统提示词',
      dataIndex: 'system_prompt',
      ellipsis: true,
      render: (text: string) => (
        <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </div>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model',
      render: (model: string) => model || <span style={{ color: '#ccc' }}>默认</span>,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 100,
      render: (color: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, backgroundColor: color, borderRadius: 4, border: '1px solid #e5e6eb' }} />
          <span>{color}</span>
        </div>
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Role) => (
        <Space>
          <Button
            type="text"
            icon={<IconEdit />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            content={`确定要删除角色 "${record.name}" 吗？`}
            onOk={() => handleDelete(record)}
          >
            <Button type="text" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="role-manager">
      <div className="role-manager-header">
        <h3>角色管理</h3>
        <Button type="primary" icon={<IconPlus />} onClick={() => handleOpenModal()}>
          创建新角色
        </Button>
      </div>

      <Table
        columns={columns}
        data={roles}
        loading={loading}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title={editingRole ? '编辑角色' : '创建新角色'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        confirmLoading={submitting}
        autoFocus={false}
        focusLock={true}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="角色名称"
            field="name"
            rules={[
              { required: true, message: '请输入角色名称' },
              { minLength: 2, message: '角色名称至少需要2个字符' },
            ]}
          >
            <Input placeholder="例如: Developer, Designer" />
          </FormItem>

          <FormItem
            label="系统提示词"
            field="system_prompt"
            rules={[
              { required: true, message: '请输入系统提示词' },
              { minLength: 10, message: '系统提示词至少需要10个字符' },
            ]}
          >
            <TextArea
              placeholder="描述这个角色的特点和专长..."
              rows={6}
              showWordLimit
            />
          </FormItem>

          <FormItem
            label="指定模型 (通过 AI API 配置获取)"
            field="model"
          >
            <Space style={{ width: '100%' }}>
              <Select
                placeholder="选择特定模型 (留空则使用默认配置)"
                allowClear
                showSearch
                allowCreate
                loading={loadingModels}
                options={models.map(m => ({ label: m.id, value: m.id }))}
                onChange={(value) => form.setFieldValue('model', value)}
                style={{ flex: 1 }}
                notFoundContent={models.length === 0 ? '点击刷新按钮获取模型列表' : '无匹配结果'}
              />
              <Button
                icon={<IconRefresh />}
                onClick={fetchModels}
                loading={loadingModels}
                title="刷新模型列表"
              />
            </Space>
          </FormItem>

          <FormItem
            label="颜色"
            field="color"
            initialValue="#3370ff"
            rules={[
              { required: true, message: '请选择颜色' },
              { match: /^#[0-9A-Fa-f]{6}$/, message: '请输入正确的十六进制颜色值' },
            ]}
          >
            <Input type="color" style={{ width: 100, height: 40 }} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  );
}
