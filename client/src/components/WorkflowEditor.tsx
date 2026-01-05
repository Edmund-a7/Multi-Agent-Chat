import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Space, Message, PageHeader, Modal, Divider } from '@arco-design/web-react';
import { IconPlus, IconDelete, IconSave, IconUp, IconDown, IconRefresh } from '@arco-design/web-react/icon';
import { useRoles } from '../contexts/RolesContext';
import { type Workflow, WorkflowService } from '../services/WorkflowService';
import api from '../services/api';
import './WorkflowEditor.css';

const FormItem = Form.Item;
const Option = Select.Option;
const TextArea = Input.TextArea;

interface WorkflowEditorProps {
    workflow?: Workflow;
    onSave: (workflow?: Workflow) => void;
    onCancel: () => void;
}

export default function WorkflowEditor({ workflow, onSave, onCancel }: WorkflowEditorProps) {
    const [form] = Form.useForm();
    const { roles, createRole } = useRoles();
    const [steps, setSteps] = useState<{
        roleId: string;
        promptTemplate: string;
        key: number;
        parallelGroup?: number;
        conditionExpression?: string;
        nextStepIndex?: number;
    }[]>([]);
    const [saving, setSaving] = useState(false);
    const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(new Set());

    // 新建角色弹窗状态
    const [roleModalVisible, setRoleModalVisible] = useState(false);
    const [roleForm] = Form.useForm();
    const [creatingRole, setCreatingRole] = useState(false);
    const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);

    // 模型列表
    const [models, setModels] = useState<{ id: string }[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [aiConfig, setAiConfig] = useState<{ base_url?: string }>({});

    useEffect(() => {
        api.get('/ai-config').then(res => setAiConfig(res.data)).catch(() => { });
    }, []);

    const fetchModels = async () => {
        try {
            if (!aiConfig.base_url) {
                const configRes = await api.get('/ai-config');
                setAiConfig(configRes.data);
                if (!configRes.data.base_url) {
                    Message.warning('请先在 AI API 配置中设置 Base URL');
                    return;
                }
            }
            setLoadingModels(true);
            const response = await api.post('/ai-config/models', { base_url: aiConfig.base_url });
            setModels(response.data.models || []);
        } catch (e) {
            Message.error('获取模型列表失败');
        } finally {
            setLoadingModels(false);
        }
    };

    const handleCreateRole = async () => {
        try {
            const values = await roleForm.validate();
            setCreatingRole(true);
            const newRole = await createRole({
                name: values.name,
                system_prompt: values.system_prompt,
                model: values.model || '',
                color: values.color || '#3370ff'
            });
            Message.success('角色创建成功');
            if (pendingStepIndex !== null) {
                handleStepChange(pendingStepIndex, 'roleId', newRole.id);
            }
            setRoleModalVisible(false);
            roleForm.resetFields();
            setPendingStepIndex(null);
        } catch (e: any) {
            if (!e.errors) {
                Message.error('创建失败: ' + e.message);
            }
        } finally {
            setCreatingRole(false);
        }
    };

    const toggleStepCollapse = (key: number) => {
        setCollapsedSteps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    useEffect(() => {
        if (workflow) {
            form.setFieldsValue({
                name: workflow.name,
                description: workflow.description
            });
            if (workflow.steps && workflow.steps.length > 0) {
                setSteps(workflow.steps.map((s, i) => ({
                    roleId: s.role_id,
                    promptTemplate: s.prompt_template || '',
                    parallelGroup: s.parallel_group,
                    key: Date.now() + i
                })));
            } else {
                // If workflow exists but has no steps (shouldn't happen often but good fallback)
                setSteps([{ roleId: '', promptTemplate: '', key: Date.now(), parallelGroup: 0 }]);
            }
        } else {
            // 新建时默认添加一个步骤
            setSteps([{ roleId: '', promptTemplate: '', key: Date.now(), parallelGroup: 0 }]);
            form.resetFields();
        }
    }, [workflow]); // Removed 'form' from dependency to avoid extra runs

    const handleAddStep = () => {
        setSteps([...steps, { roleId: '', promptTemplate: '', key: Date.now(), parallelGroup: 0 }]);
    };

    const handleAddParallelStep = (index: number) => {
        const currentStep = steps[index];
        const newSteps = [...steps];

        // Determine group ID: use current if >0, else generate new
        // Note: Using a simple timestamp-based ID for groups might be safer than random for now,
        // but simple increment or existing logic is fine. 
        // Let's use a random integer for the group ID to avoid collision with serial (0).
        let groupId = currentStep.parallelGroup || 0;
        if (groupId === 0) {
            groupId = Math.floor(Math.random() * 10000) + 1;
            // Update current step to be part of this group
            newSteps[index] = { ...currentStep, parallelGroup: groupId };
        }

        // Insert new step after current
        newSteps.splice(index + 1, 0, {
            roleId: '',
            promptTemplate: '',
            key: Date.now(),
            parallelGroup: groupId
        });

        setSteps(newSteps);
    };

    const handleRemoveStep = (index: number) => {
        const newSteps = [...steps];
        // If removing a step from a parallel group, check if others remain in group.
        // If only one remains, maybe reset its group to 0? Optional cleanup.
        // For now simple remove is fine.
        newSteps.splice(index, 1);
        setSteps(newSteps);
    };

    const handleMoveStep = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const newSteps = [...steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
        setSteps(newSteps);
    };

    const handleStepChange = (index: number, field: string, value: any) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSteps(newSteps);
    };

    const handleSaveWrapper = async () => {
        console.log('Save button clicked');
        try {
            await form.validate();
            console.log('Form validation passed');
        } catch (e) {
            console.error('Form validation failed', e);
            Message.error('请填写必要的基本信息');
            return;
        }
        // 验证步骤
        console.log('Validating steps:', steps);
        for (const step of steps) {
            if (!step.roleId) {
                Message.error('所有步骤都必须选择角色');
                return;
            }
        }
        setSaving(true);
        const values = form.getFieldsValue();
        console.log('Form values:', values);

        try {
            const stepsData = steps.map(s => ({
                roleId: s.roleId,
                promptTemplate: s.promptTemplate,
                parallelGroup: s.parallelGroup, // Now managed by button logic
                conditionExpression: s.conditionExpression,
                nextStepIndex: s.nextStepIndex
            }));
            console.log('Steps data to save:', stepsData);

            let savedWf;
            if (workflow) {
                console.log('Updating existing workflow:', workflow.id);
                savedWf = await WorkflowService.update(workflow.id, {
                    name: values.name,
                    description: values.description,
                    steps: stepsData
                });
            } else {
                console.log('Creating new workflow');
                const newWf = await WorkflowService.create(values.name, values.description);
                console.log('Created basic workflow, updating steps...');
                savedWf = await WorkflowService.update(newWf.id, {
                    steps: stepsData
                });
            }
            console.log('Save successful, calling onSave with:', savedWf);
            onSave(savedWf); // Pass saved workflow back
        } catch (error) {
            console.error('Save failed:', error);
            // Message.error('保存失败'); // Disabled due to React 19 compatibility issue
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="workflow-editor">
            <PageHeader
                style={{ padding: '0 0 20px 0' }}
                title={workflow ? '编辑工作流' : '新建工作流'}
                onBack={onCancel}
                extra={
                    <Space>
                        <Button onClick={onCancel}>取消</Button>
                        <Button type="primary" icon={<IconSave />} loading={saving} onClick={handleSaveWrapper}>
                            保存
                        </Button>
                    </Space>
                }
            />

            <div className="workflow-editor-content">
                <Card title="基本信息" style={{ marginBottom: 20 }}>
                    <Form form={form} layout="vertical">
                        <FormItem label="工作流名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
                            <Input placeholder="例如：文章润色流程" />
                        </FormItem>
                        <FormItem label="描述" field="description">
                            <Input.TextArea placeholder="简要描述该工作流的用途" />
                        </FormItem>
                    </Form>
                </Card>

                <div className="workflow-steps-title">
                    <h3>流程步骤</h3>
                </div>

                <div className="workflow-steps-list">
                    {steps.map((step, index) => {
                        const isParallel = (step.parallelGroup || 0) > 0;
                        // Check if previous step is in same group
                        const isSameGroupAsPrev = index > 0 &&
                            steps[index - 1].parallelGroup === step.parallelGroup &&
                            isParallel;

                        return (
                            <div
                                key={step.key}
                                className={`step-wrapper ${isParallel ? 'parallel-step' : ''}`}
                            >
                                <div className="step-connector-dot" />
                                <Card
                                    className="workflow-step-card"
                                    style={{ marginBottom: 16 }}
                                >
                                    <div className="step-header" style={{ cursor: 'pointer' }} onClick={() => toggleStepCollapse(step.key)}>
                                        <span className="step-index">
                                            {collapsedSteps.has(step.key) ? '▶' : '▼'} 步骤 {index + 1}
                                            {isParallel && (
                                                <span className="parallel-badge">
                                                    {isSameGroupAsPrev ? '↳ 并行' : '并行组'}
                                                </span>
                                            )}
                                            {step.roleId && (
                                                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-3)' }}>
                                                    ({roles.find(r => r.id === step.roleId)?.name || '未选择'})
                                                </span>
                                            )}
                                        </span>
                                        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                            <Space>
                                                <Button
                                                    type="secondary"
                                                    size="mini"
                                                    onClick={() => handleAddParallelStep(index)}
                                                >
                                                    添加并行
                                                </Button>
                                                <div style={{ width: 1, height: 16, background: 'var(--color-border-2)', margin: '0 8px' }} />
                                                <Button
                                                    icon={<IconUp />}
                                                    size="mini"
                                                    disabled={index === 0}
                                                    onClick={() => handleMoveStep(index, 'up')}
                                                />
                                                <Button
                                                    icon={<IconDown />}
                                                    size="mini"
                                                    disabled={index === steps.length - 1}
                                                    onClick={() => handleMoveStep(index, 'down')}
                                                />
                                                <Button
                                                    status="danger"
                                                    icon={<IconDelete />}
                                                    size="mini"
                                                    onClick={() => handleRemoveStep(index)}
                                                />
                                            </Space>
                                        </div>
                                    </div>

                                    {!collapsedSteps.has(step.key) && (
                                        <div className="step-content">
                                            <div className="step-field">
                                                <span className="label">选择角色 <span style={{ color: 'red' }}>*</span></span>
                                                <Select
                                                    placeholder="选择执行此步骤的角色"
                                                    value={step.roleId}
                                                    onChange={(val) => {
                                                        if (val === '__create_new__') {
                                                            setPendingStepIndex(index);
                                                            setRoleModalVisible(true);
                                                        } else {
                                                            handleStepChange(index, 'roleId', val);
                                                        }
                                                    }}
                                                    style={{ width: '100%' }}
                                                >
                                                    {roles.map(role => (
                                                        <Option key={role.id} value={role.id}>
                                                            <span style={{ display: 'flex', alignItems: 'center' }}>
                                                                <span className="role-avatar-small" style={{ backgroundColor: role.color }}>
                                                                    {role.name[0]}
                                                                </span>
                                                                {role.name}
                                                            </span>
                                                        </Option>
                                                    ))}
                                                    <Option key="__divider__" value="__divider__" disabled>
                                                        <Divider style={{ margin: '4px 0' }} />
                                                    </Option>
                                                    <Option key="__create_new__" value="__create_new__">
                                                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--primary-6)' }}>
                                                            <IconPlus style={{ marginRight: 8 }} />
                                                            新建角色...
                                                        </span>
                                                    </Option>
                                                </Select>
                                            </div>

                                            <div className="step-field">
                                                <span className="label">提示词模板 (可选)</span>
                                                <Input.TextArea
                                                    placeholder="输入给该角色的具体指令。如果不填，将直接使用上一歩的输出/初始输入。"
                                                    value={step.promptTemplate}
                                                    onChange={(val) => handleStepChange(index, 'promptTemplate', val)}
                                                    rows={3}
                                                />
                                                <div className="field-tip">提示：此处的输入将附加在用户原始输入/上一步输出之前。</div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        );
                    })}

                    <Button
                        type="dashed"
                        long
                        icon={<IconPlus />}
                        onClick={handleAddStep}
                        style={{ height: 48, marginBottom: 40 }}
                    >
                        添加步骤
                    </Button>
                </div>
            </div>

            {/* 新建角色弹窗 */}
            <Modal
                title="创建新角色"
                visible={roleModalVisible}
                onOk={handleCreateRole}
                onCancel={() => {
                    setRoleModalVisible(false);
                    roleForm.resetFields();
                    setPendingStepIndex(null);
                }}
                confirmLoading={creatingRole}
                autoFocus={false}
                focusLock={true}
            >
                <Form form={roleForm} layout="vertical">
                    <FormItem
                        label="角色名称"
                        field="name"
                        rules={[
                            { required: true, message: '请输入角色名称' },
                            { minLength: 2, message: '角色名称至少需要2个字符' },
                        ]}
                    >
                        <Input placeholder="例如: 文案专家, 图片描述师" />
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
                                onChange={(value) => roleForm.setFieldValue('model', value)}
                                style={{ flex: 1, minWidth: 250 }}
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
                        ]}
                    >
                        <Input type="color" style={{ width: 100, height: 40 }} />
                    </FormItem>
                </Form>
            </Modal>
        </div>
    );
}
