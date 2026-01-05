import { useState, useEffect } from 'react';
import { List, Button, Empty, Popconfirm, Spin } from '@arco-design/web-react';
import { IconPlus, IconDelete, IconEdit, IconHistory } from '@arco-design/web-react/icon';
import { type Workflow, WorkflowService } from '../services/WorkflowService';
import './WorkflowList.css';

interface WorkflowListProps {
    onSelect: (workflow: Workflow) => void;
    onEdit: (workflow: Workflow) => void;
    onCreate: () => void;
    onViewHistory: () => void;
    onDelete?: (id: string) => void; // Callback for deletion
    selectedId?: string;
    refreshTrigger?: number;
}

export default function WorkflowList({ onSelect, onEdit, onCreate, onViewHistory, onDelete, selectedId, refreshTrigger }: WorkflowListProps) {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(false);

    // ... fetchWorkflows code ... (omitted for brevity in replacement, but I must match exact target content effectively)
    // Actually, I should just target the specific blocks or ensure I replace correctly.
    // Let's replace the interface and function signature first.

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
            const data = await WorkflowService.getAll();
            if (Array.isArray(data)) {
                setWorkflows(data);
            } else {
                console.error('Workflow check: data is not array', data);
                setWorkflows([]);
            }
        } catch (error) {
            console.error(error);
            // Message.error('加载工作流列表失败');
            setWorkflows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkflows();
    }, [refreshTrigger]);

    const handleDelete = async (id: string) => {
        try {
            await WorkflowService.delete(id);
            // Message.success('删除成功');
            fetchWorkflows();
            if (onDelete) {
                onDelete(id);
            }
        } catch (error) {
            // Message.error('删除失败');
            console.error('Delete failed', error);
        }
    };

    return (
        <div className="workflow-list">
            <div className="workflow-list-header">
                <h3>工作流</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                        icon={<IconHistory />}
                        onClick={onViewHistory}
                        size="small"
                        title="查看历史"
                    />
                    <Button
                        type="primary"
                        icon={<IconPlus />}
                        onClick={onCreate}
                        size="small"
                    >
                        新建
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">
                    <Spin />
                </div>
            ) : workflows.length === 0 ? (
                <div className="workflow-list-empty">
                    <Empty description="暂无工作流" />
                </div>
            ) : (
                <List
                    className="workflow-items"
                    dataSource={workflows}
                    render={(item: Workflow) => (
                        <List.Item
                            key={item.id}
                            className={`workflow-item ${selectedId === item.id ? 'active' : ''}`}
                            onClick={() => onSelect(item)}
                            actions={[
                                <Button
                                    key="edit"
                                    type="text"
                                    icon={<IconEdit />}
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(item);
                                    }}
                                />,
                                <Popconfirm
                                    key="delete"
                                    title="确认删除"
                                    content={`确定要删除工作流 "${item.name}" 吗？`}
                                    onOk={() => handleDelete(item.id)}
                                >
                                    <Button
                                        type="text"
                                        icon={<IconDelete />}
                                        size="small"
                                        status="danger"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </Popconfirm>
                            ]}
                        >
                            <List.Item.Meta
                                title={item.name}
                                description={
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {item.description && <div style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>}
                                        <div>{new Date(item.updated_at || item.created_at).toLocaleString()}</div>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
}
