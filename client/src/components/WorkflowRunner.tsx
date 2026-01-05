import { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Steps, Message, Spin, PageHeader } from '@arco-design/web-react';
import { IconPlayArrow, IconStop, IconCloseCircle } from '@arco-design/web-react/icon';
import ReactMarkdown from 'react-markdown';
import { type Workflow, type WorkflowRun, WorkflowService } from '../services/WorkflowService';
import './WorkflowRunner.css';

const Step = Steps.Step;

interface WorkflowRunnerProps {
    workflow: Workflow;
    initialRun?: WorkflowRun | null;
    onBack: () => void;
}

export default function WorkflowRunner({ workflow, initialRun, onBack }: WorkflowRunnerProps) {
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [runningStepIndices, setRunningStepIndices] = useState<Set<number>>(new Set());
    const [stepResults, setStepResults] = useState<any[]>([]);
    // const [runId, setRunId] = useState<string>(''); // Not currently used
    const [finalResult, setFinalResult] = useState('');
    const [error, setError] = useState('');
    const [collapsedSteps, setCollapsedSteps] = useState<Set<string>>(new Set());

    const toggleStepCollapse = (stepId: string) => {
        setCollapsedSteps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stepId)) {
                newSet.delete(stepId);
            } else {
                newSet.add(stepId);
            }
            return newSet;
        });
    };

    // 滚动到底部引用
    const bottomRef = useRef<HTMLDivElement>(null);
    // AbortController for cancelling runs
    const abortControllerRef = useRef<AbortController | null>(null);

    const steps = workflow.steps || [];

    // Use a ref to track if we've initialized for this run/workflow
    const initRef = useRef('');

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsRunning(false);
            setError('运行已中断');
        }
    };

    useEffect(() => {
        const currentInitKey = initialRun ? initialRun.id : workflow.id;

        // Only initialize if we haven't already for this key
        if (initRef.current === currentInitKey) {
            return;
        }
        initRef.current = currentInitKey;

        if (initialRun) {
            setInput(initialRun.input_text || '');
            setFinalResult(initialRun.final_result || '');
            if (initialRun.stepResults) {
                setStepResults(initialRun.stepResults.map(r => ({
                    stepId: r.step_id,
                    stepOrder: r.step_order,
                    roleId: '', // We might not have roleId directly in result, but we can match with steps if needed
                    status: r.status,
                    output: r.output_text,
                    error: r.error_message
                })));
                // Set current step index to the last one
                setRunningStepIndices(new Set());
            }
        } else {
            // Reset state for new run
            setInput('');
            setFinalResult('');
            setStepResults([]);
            setRunningStepIndices(new Set());
        }
    }, [initialRun, workflow.id]); // Removed 'steps' from dependency as it causes loop if reference unstable

    const handleRun = async () => {
        if (!input.trim()) return;

        // Create new AbortController for this run
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsRunning(true);
        setRunningStepIndices(new Set());
        setStepResults(steps.map((s) => ({
            stepId: s.id,
            stepOrder: s.step_order,
            roleId: s.role_id,
            status: 'pending',
            output: '',
            error: ''
        })));
        setFinalResult('');
        setError('');

        try {
            await WorkflowService.runWorkflowStream(workflow.id, input, (event, data) => {
                if (event === 'run_start') {
                    // setRunId(data.runId);
                    // 初始化状态
                    setStepResults(data.steps.map((s: any) => ({
                        ...s,
                        status: 'pending',
                        output: '',
                        chunk: '' // 用于累计流式输出
                    })));
                } else if (event === 'step_start') {
                    // 添加到运行中的步骤集合（支持并行）
                    const idx = steps.findIndex(s => s.step_order === data.stepOrder);
                    if (idx !== -1) {
                        setRunningStepIndices(prev => new Set([...prev, idx]));
                    }

                    setStepResults(prev => prev.map(s => {
                        if (s.stepId === data.stepId || s.step_id === data.stepId) {
                            return { ...s, status: 'running', startedAt: Date.now() };
                        }
                        return s;
                    }));
                } else if (event === 'step_chunk') {
                    setStepResults(prev => prev.map(s => {
                        if (s.stepId === data.stepId || s.step_id === data.stepId) {
                            return { ...s, chunk: (s.chunk || '') + data.chunk };
                        }
                        return s;
                    }));
                } else if (event === 'step_complete') {
                    setStepResults(prev => prev.map(s => {
                        if (s.stepId === data.stepId || s.step_id === data.stepId) {
                            return { ...s, status: 'completed', output: data.output, chunk: '', completedAt: Date.now() };
                        }
                        return s;
                    }));
                } else if (event === 'step_error') {
                    setStepResults(prev => prev.map(s => {
                        if (s.stepId === data.stepId || s.step_id === data.stepId) {
                            return { ...s, status: 'failed', error: data.error, completedAt: Date.now() };
                        }
                        return s;
                    }));
                } else if (event === 'run_complete') {
                    setFinalResult(data.finalResult);
                    setIsRunning(false);
                    setRunningStepIndices(new Set()); // 完成
                } else if (event === 'run_error') {
                    setError(data.error);
                    setIsRunning(false);
                }
            }, controller.signal);
        } catch (e: any) {
            if (e.name === 'AbortError') {
                // User cancelled, already handled in handleStop
                return;
            }
            setError(e.message);
            setIsRunning(false);
            Message.error('运行出错: ' + e.message);
        } finally {
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="workflow-runner">
            <PageHeader
                title={workflow.name}
                subTitle={initialRun ? '历史记录' : workflow.description}
                onBack={onBack}
                extra={
                    !isRunning && !initialRun && (
                        <Button onClick={() => {
                            setStepResults([]);
                            setFinalResult('');
                            setRunningStepIndices(new Set());
                        }}>
                            重置
                        </Button>
                    )
                }
            />

            <div className="runner-content">
                {/* 输入区 */}
                <Card className="input-card" title="输入内容">
                    <Input.TextArea
                        disabled={isRunning || !!initialRun}
                        value={input}
                        onChange={setInput}
                        placeholder="请输入初始内容..."
                        rows={5}
                        style={{ marginBottom: 16 }}
                    />
                    {!initialRun && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            {isRunning ? (
                                <Button
                                    type="primary"
                                    status="danger"
                                    icon={<IconStop />}
                                    onClick={handleStop}
                                    long
                                >
                                    停止运行
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<IconPlayArrow />}
                                    onClick={handleRun}
                                    long
                                >
                                    开始运行
                                </Button>
                            )}
                        </div>
                    )}
                </Card>

                {/* 执行过程 */}
                {steps.length > 0 && (
                    <div className="execution-area">
                        <div className="workflow-steps-indicator">
                            <Steps current={-1} direction="vertical" style={{ maxWidth: '100%' }}>
                                {steps.map((step, index) => {
                                    // Find result by step_id first
                                    let result = stepResults.find(r => r.stepId === step.id) || {};

                                    // Fallback: match by step_order if stepId mismatch (legacy data or initialRun mapping)
                                    if (!result.stepId) {
                                        result = stepResults.find(r => r.stepOrder === step.step_order) || {};
                                    }

                                    const isRunning = result.status === 'running';
                                    const isCompleted = result.status === 'completed';
                                    const isFailed = result.status === 'failed';
                                    const isActive = runningStepIndices.has(index) || isRunning;

                                    return (
                                        <Step
                                            key={step.id}
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span>{step.role_name || '步骤 ' + (index + 1)}</span>
                                                    {result.startedAt && (
                                                        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                                                            {new Date(result.startedAt).toLocaleTimeString()}
                                                            {result.completedAt && (
                                                                <> → {new Date(result.completedAt).toLocaleTimeString()}
                                                                    <span style={{ marginLeft: 4, color: 'var(--color-success-6)' }}>
                                                                        ({((result.completedAt - result.startedAt) / 1000).toFixed(1)}s)
                                                                    </span>
                                                                </>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            }
                                            description={
                                                <div className="step-detail-box">
                                                    {isRunning && (
                                                        <div className="step-running">
                                                            <Spin dot />
                                                            <div className="streaming-output">
                                                                {result.chunk || '正在思考...'}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isCompleted && (
                                                        <div>
                                                            {/* Extract and display images separately */}
                                                            {(() => {
                                                                const output = result.output || '';
                                                                // Separate thinking (text before image) and images
                                                                const imageMatches = output.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
                                                                const thinkingText = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim();

                                                                return (
                                                                    <>
                                                                        {/* Show images first, always visible */}
                                                                        {imageMatches.length > 0 && (
                                                                            <div style={{ marginBottom: 12 }}>
                                                                                {imageMatches.map((imgMd: string, idx: number) => {
                                                                                    const urlMatch = imgMd.match(/\(([^)]+)\)/);
                                                                                    const url = urlMatch ? urlMatch[1] : '';
                                                                                    return (
                                                                                        <img
                                                                                            key={idx}
                                                                                            src={url}
                                                                                            alt="Generated"
                                                                                            style={{
                                                                                                maxWidth: '100%',
                                                                                                borderRadius: 8,
                                                                                                marginTop: 8,
                                                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                        {/* Collapsible thinking text */}
                                                                        {thinkingText && (
                                                                            <>
                                                                                <div
                                                                                    onClick={() => toggleStepCollapse(step.id)}
                                                                                    style={{
                                                                                        cursor: 'pointer',
                                                                                        color: 'var(--color-text-3)',
                                                                                        fontSize: 12,
                                                                                        marginTop: 4,
                                                                                        userSelect: 'none'
                                                                                    }}
                                                                                >
                                                                                    {collapsedSteps.has(step.id) ? '▶ 显示思考过程' : '▼ 隐藏思考过程'}
                                                                                </div>
                                                                                {!collapsedSteps.has(step.id) && (
                                                                                    <div className="markdown-body" style={{
                                                                                        marginTop: 8,
                                                                                        padding: 12,
                                                                                        background: 'var(--color-fill-1)',
                                                                                        borderRadius: 4,
                                                                                        fontSize: 13,
                                                                                        color: 'var(--color-text-2)',
                                                                                        overflowX: 'auto',
                                                                                        wordBreak: 'break-word',
                                                                                        maxWidth: '100%'
                                                                                    }}>
                                                                                        <ReactMarkdown>{thinkingText}</ReactMarkdown>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}

                                                                        {/* If no thinking but also no images, show full output */}
                                                                        {!thinkingText && imageMatches.length === 0 && output && (
                                                                            <div className="markdown-body" style={{ marginTop: 8, padding: 12, background: 'var(--color-fill-1)', borderRadius: 4 }}>
                                                                                <ReactMarkdown>{output}</ReactMarkdown>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                    {isFailed && (
                                                        <div className="error-msg">
                                                            {result.error}
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                            status={isFailed ? 'error' : (isActive ? 'process' : (isCompleted ? 'finish' : 'wait'))}
                                        />
                                    );
                                })}
                            </Steps>
                        </div>
                    </div>
                )}

                {/* 最终结果 */}
                {finalResult && (
                    <Card className="result-card" title="最终结果">
                        <div className="markdown-body">
                            <ReactMarkdown>{finalResult}</ReactMarkdown>
                        </div>
                    </Card>
                )}

                {error && (
                    <div className="global-error">
                        <IconCloseCircle style={{ marginRight: 8 }} />
                        运行失败: {error}
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
}
