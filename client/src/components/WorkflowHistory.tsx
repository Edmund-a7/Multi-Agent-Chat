import { useState, useEffect } from 'react';
import { List, Button, Tag, Typography, Message, Empty, Spin, Popconfirm } from '@arco-design/web-react';
import { IconHistory, IconRight, IconDelete } from '@arco-design/web-react/icon';
import { WorkflowService, type WorkflowRun } from '../services/WorkflowService';
import './WorkflowHistory.css';

interface WorkflowHistoryProps {
    onSelectRun: (run: WorkflowRun) => void;
    onBack?: () => void;
}

export default function WorkflowHistory({ onSelectRun, onBack }: WorkflowHistoryProps) {
    const [history, setHistory] = useState<WorkflowRun[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await WorkflowService.getHistory();
            if (Array.isArray(data)) {
                setHistory(data);
            } else {
                console.error('History check: data is not array', data);
                setHistory([]);
            }
        } catch (error) {
            console.error(error);
            Message.error('获取历史记录失败');
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (runId: string) => {
        try {
            await WorkflowService.deleteRun(runId);
            fetchHistory(); // Refresh list
        } catch (error) {
            console.error('Delete failed', error);
        }
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'completed': return <Tag color="green">完成</Tag>;
            case 'running': return <Tag color="blue">进行中</Tag>;
            case 'failed': return <Tag color="red">失败</Tag>;
            default: return <Tag>未知</Tag>;
        }
    };

    const handleViewRun = async (runId: string) => {
        try {
            const run = await WorkflowService.getRunDetail(runId);
            if (run) {
                onSelectRun(run);
            }
        } catch (error) {
            Message.error('获取详情失败');
        }
    };

    return (
        <div className="workflow-history">
            <div className="history-header">
                <Typography.Title heading={5} style={{ margin: 0 }}>
                    <IconHistory style={{ marginRight: 8 }} />
                    执行历史
                </Typography.Title>
                {onBack && <Button onClick={onBack}>返回</Button>}
            </div>

            <div className="history-list-container">
                {loading ? (
                    <div className="loading-container">
                        <Spin />
                    </div>
                ) : history.length === 0 ? (
                    <Empty description="暂无运行记录" />
                ) : (
                    <List
                        className="history-list"
                        dataSource={history}
                        render={(run) => (
                            <List.Item
                                key={run.id}
                                actions={[
                                    <Button key="view" type="text" size="small" onClick={() => handleViewRun(run.id)}>
                                        查看详情 <IconRight />
                                    </Button>,
                                    <Popconfirm
                                        key="delete"
                                        title="确认删除"
                                        content="确定要删除这条运行记录吗？"
                                        onOk={() => handleDelete(run.id)}
                                    >
                                        <Button type="text" size="small" status="danger" icon={<IconDelete />}>
                                            删除
                                        </Button>
                                    </Popconfirm>
                                ]}
                            >
                                <List.Item.Meta
                                    title={
                                        <div className="history-item-title">
                                            <span className="workflow-name">{run.workflow_name || '未命名工作流'}</span>
                                            {getStatusTag(run.status)}
                                        </div>
                                    }
                                    description={
                                        <div className="history-item-desc">
                                            <div className="history-time">
                                                开始时间: {new Date(run.started_at).toLocaleString()}
                                            </div>
                                            <div className="history-input">
                                                输入: {run.input_text?.substring(0, 50)}{run.input_text && run.input_text.length > 50 ? '...' : ''}
                                            </div>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>
        </div>
    );
}
