import { Router, Request, Response } from 'express';
import { WorkflowService } from '../services/WorkflowService';
import { RoleService } from '../services/RoleService';
import { AIService } from '../services/AIService';
import { authMiddleware } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Helper: Extract images from markdown and prepare multimodal content
const extractImagesFromMarkdown = (text: string): { textContent: string; images: Array<{ base64: string; mime: string }> } => {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: Array<{ base64: string; mime: string }> = [];
    let textContent = text;
    let match;

    while ((match = imageRegex.exec(text)) !== null) {
        const imagePath = match[2];

        // Handle local file paths (from /uploads/)
        if (imagePath.startsWith('/uploads/')) {
            const fullPath = path.join(process.cwd(), imagePath);
            if (fs.existsSync(fullPath)) {
                try {
                    const imageBuffer = fs.readFileSync(fullPath);
                    const base64 = imageBuffer.toString('base64');

                    // Detect mime type
                    let mime = 'image/png';
                    if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
                        mime = 'image/jpeg';
                    } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
                        mime = 'image/png';
                    } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
                        mime = 'image/gif';
                    }

                    images.push({ base64, mime });
                    // Remove image markdown from text (will be sent as multimodal)
                    textContent = textContent.replace(match[0], '').trim();
                } catch (e) {
                    console.error('[Workflow] Failed to read image:', e);
                }
            }
        }
    }

    return { textContent, images };
};

// 所有路由都需要认证
router.use(authMiddleware);

// ===== 工作流 CRUD =====

// 获取用户的所有工作流
router.get('/', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const workflows = WorkflowService.getAll(userId);
        res.json(workflows);
    } catch (error: any) {
        console.error('[Workflow] 获取列表失败:', error.message);
        res.status(500).json({ error: '获取工作流列表失败' });
    }
});

// 创建工作流
router.post('/', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: '工作流名称不能为空' });
        }

        const workflow = WorkflowService.create(userId, name, description);
        res.status(201).json(workflow);
    } catch (error: any) {
        console.error('[Workflow] 创建失败:', error.message);
        res.status(500).json({ error: '创建工作流失败' });
    }
});

// 获取单个工作流（包含步骤）
router.get('/:id', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const workflow = WorkflowService.getById(id, userId);
        if (!workflow) {
            return res.status(404).json({ error: '工作流不存在' });
        }

        const steps = WorkflowService.getSteps(id);
        res.json({ ...workflow, steps });
    } catch (error: any) {
        console.error('[Workflow] 获取详情失败:', error.message);
        res.status(500).json({ error: '获取工作流失败' });
    }
});

// 更新工作流
router.put('/:id', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;
        const { name, description, steps } = req.body;

        // 更新工作流基本信息
        WorkflowService.update(id, userId, { name, description });

        // 如果提供了步骤，更新步骤
        if (steps && Array.isArray(steps)) {
            const newSteps = WorkflowService.replaceSteps(id, steps);
            const workflow = WorkflowService.getById(id, userId);
            return res.json({ ...workflow, steps: newSteps });
        }

        const workflow = WorkflowService.getById(id, userId);
        const updatedSteps = WorkflowService.getSteps(id);
        res.json({ ...workflow, steps: updatedSteps });
    } catch (error: any) {
        console.error('[Workflow] 更新失败:', error.message);
        res.status(500).json({ error: '更新工作流失败' });
    }
});

// 删除工作流
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const success = WorkflowService.delete(id, userId);
        if (!success) {
            return res.status(404).json({ error: '工作流不存在' });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[Workflow] 删除失败:', error.message);
        res.status(500).json({ error: '删除工作流失败' });
    }
});

// ===== 运行工作流（SSE 流式）=====

// ===== 运行工作流（SSE 流式）=====

router.post('/:id/run', async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ error: '输入内容不能为空' });
        }

        // 获取工作流和步骤
        const workflow = WorkflowService.getById(id, userId);
        if (!workflow) {
            return res.status(404).json({ error: '工作流不存在' });
        }

        const steps = WorkflowService.getSteps(id);
        if (steps.length === 0) {
            return res.status(400).json({ error: '工作流没有步骤' });
        }

        // 获取 AI 配置
        const aiConfig = AIService.getConfig(userId);
        if (!aiConfig || !aiConfig.api_key) {
            return res.status(400).json({ error: '请先配置 AI API' });
        }

        // 设置 SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 创建运行记录
        const run = WorkflowService.createRun(id, userId, input);

        // 创建步骤结果记录 (Map storage for easy access)
        const stepResultsMap = new Map<string, any>();
        const stepResultsArr: any[] = [];

        for (const step of steps) {
            const result = WorkflowService.createStepResult(run.id, step.id, step.step_order, step.role_name || '未知角色');
            stepResultsMap.set(step.id, result);
            stepResultsArr.push(result);
        }

        // 发送初始状态
        res.write(`event: run_start\n`);
        res.write(`data: ${JSON.stringify({ runId: run.id, steps: stepResultsArr })}\n\n`);

        // Helper to run a single step
        const executeStep = async (step: typeof steps[0], stepInput: string) => {
            const stepResult = stepResultsMap.get(step.id);
            if (!stepResult) return '';

            // 发送步骤开始事件
            res.write(`event: step_start\n`);
            res.write(`data: ${JSON.stringify({ stepId: stepResult.id, stepOrder: step.step_order })}\n\n`);

            // 更新步骤状态为执行中
            WorkflowService.updateStepResult(stepResult.id, {
                status: 'running',
                inputText: stepInput,
                startedAt: Date.now()
            });

            try {
                // 获取角色配置
                const role = RoleService.getById(step.role_id, userId);
                const systemPrompt = role?.system_prompt || '你是一个helpful的AI助手。';
                const model = role?.model || aiConfig.model;

                // 构建提示词
                const basePrompt = step.prompt_template
                    ? `${step.prompt_template}\n\n${stepInput}`
                    : stepInput;

                // 提取图像并构建多模态内容
                const { textContent, images } = extractImagesFromMarkdown(basePrompt);

                // 构建消息内容
                let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

                if (images.length > 0) {
                    // 多模态消息：文本 + 图片
                    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

                    if (textContent.trim()) {
                        contentParts.push({ type: 'text', text: textContent });
                    }

                    for (const img of images) {
                        contentParts.push({
                            type: 'image_url',
                            image_url: { url: `data:${img.mime};base64,${img.base64}` }
                        });
                    }

                    messageContent = contentParts;
                    console.log(`[Workflow] Step ${step.step_order}: Sending ${images.length} image(s) to model ${model}`);
                } else {
                    // 纯文本消息
                    messageContent = basePrompt;
                }

                // 调用 AI
                const stepConfig = { ...aiConfig, model };
                let stepOutput = '';

                await AIService.chatStream(
                    stepConfig,
                    systemPrompt,
                    [{ role: 'user', content: messageContent }],
                    (chunk: string) => {
                        stepOutput += chunk;
                        res.write(`event: step_chunk\n`);
                        res.write(`data: ${JSON.stringify({ stepId: stepResult.id, chunk })}\n\n`);
                    }
                );

                // 更新步骤结果为完成
                WorkflowService.updateStepResult(stepResult.id, {
                    status: 'completed',
                    outputText: stepOutput,
                    completedAt: Date.now()
                });

                res.write(`event: step_complete\n`);
                res.write(`data: ${JSON.stringify({ stepId: stepResult.id, output: stepOutput })}\n\n`);

                return stepOutput;
            } catch (stepError: any) {
                // 步骤执行失败
                WorkflowService.updateStepResult(stepResult.id, {
                    status: 'failed',
                    errorMessage: stepError.message,
                    completedAt: Date.now()
                });

                res.write(`event: step_error\n`);
                res.write(`data: ${JSON.stringify({ stepId: stepResult.id, error: stepError.message })}\n\n`);
                throw stepError;
            }
        };

        // 执行工作流
        let currentInput = input;
        let finalResult = '';

        try {
            // New execution logic supporting conditional jumps
            // We still group by parallel blocks for execution, but we process them sequentially with index control

            // Re-calculate blocks dynamically or just iterate manually? 
            // Better: Iterate through steps array. Identify a block of parallel steps starting at current index.
            // Execute them. Then, check condition of *last* step in that block (simplification).
            // Update index based on result.

            let stepIndex = 0;
            while (stepIndex < steps.length) {
                const currentStep = steps[stepIndex];

                // Debug: log parallel_group values
                console.log(`[Workflow Debug] Step ${stepIndex}: parallel_group = ${currentStep.parallel_group}, role = ${currentStep.role_name}`);

                // Identify parallel block
                const currentBlock: typeof steps = [currentStep];
                let nextIndex = stepIndex + 1;

                if (currentStep.parallel_group > 0) {
                    console.log(`[Workflow Debug] Step ${stepIndex} is in parallel group ${currentStep.parallel_group}, looking for siblings...`);
                    while (nextIndex < steps.length) {
                        const nextStep = steps[nextIndex];
                        console.log(`[Workflow Debug] Checking step ${nextIndex}: parallel_group = ${nextStep.parallel_group}`);
                        if (nextStep.parallel_group === currentStep.parallel_group) {
                            currentBlock.push(nextStep);
                            nextIndex++;
                        } else {
                            break;
                        }
                    }
                    console.log(`[Workflow Debug] Parallel block size: ${currentBlock.length}`);
                }


                // Execute Block
                let blockOutput = '';
                if (currentBlock.length === 1) {
                    blockOutput = await executeStep(currentBlock[0], currentInput);
                    // For single step, update input for next step
                    currentInput = blockOutput;
                } else {
                    // Parallel Block
                    const results = await Promise.all(currentBlock.map(step => executeStep(step, currentInput)));
                    // Combine outputs
                    blockOutput = results.map((out, idx) => {
                        const step = currentBlock[idx];
                        const roleName = step.role_name || `Step ${step.step_order}`;
                        return `### Result from ${roleName}:\n${out}`;
                    }).join('\n\n');
                    currentInput = blockOutput;
                }

                finalResult = currentInput;

                // Check for Conditional Jump (Only for sequential steps or the last step of a block for now)
                // We'll check the last step of the block for any jumping logic
                const lastStepInBlock = currentBlock[currentBlock.length - 1];

                if (lastStepInBlock.condition_expression && lastStepInBlock.next_step_index !== undefined && lastStepInBlock.next_step_index !== null) {
                    // Simple evaluation: if output contains expression string
                    // In a real app, use a safe eval or a dedicated expression match like "failed" or "retry"
                    // Here: We check if blockOutput INCLUDES the expression
                    try {
                        const conditionMet = blockOutput.includes(lastStepInBlock.condition_expression);
                        if (conditionMet) {
                            // Find index of step with step_order == next_step_index
                            const targetIndex = steps.findIndex(s => s.step_order === lastStepInBlock.next_step_index!);
                            if (targetIndex !== -1) {
                                stepIndex = targetIndex;
                                continue; // Jump to new index
                            }
                        }
                    } catch (e) {
                        console.error('Condition eval failed', e);
                    }
                }

                // Normal progression
                stepIndex = nextIndex;
            }

            // 所有步骤完成
            WorkflowService.updateRun(run.id, {
                status: 'completed',
                finalResult,
                completedAt: Date.now()
            });

            res.write(`event: run_complete\n`);
            res.write(`data: ${JSON.stringify({ runId: run.id, finalResult })}\n\n`);
            res.end();

        } catch (err: any) {
            // Error handled in executeStep for individual steps, but if we catch here it means flow stopped
            WorkflowService.updateRun(run.id, {
                status: 'failed',
                completedAt: Date.now()
            });

            res.write(`event: run_error\n`);
            res.write(`data: ${JSON.stringify({ runId: run.id, error: err.message })}\n\n`);
            res.end();
        }

    } catch (error: any) {
        console.error('[Workflow] 执行失败:', error.message);
        // If headers not sent, send error json
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
});

// ===== 历史记录 =====

// 获取运行历史
router.get('/history/list', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const limit = parseInt(req.query.limit as string) || 20;
        const history = WorkflowService.getRunHistory(userId, limit);
        res.json(history);
    } catch (error: any) {
        console.error('[Workflow] 获取历史失败:', error.message);
        res.status(500).json({ error: '获取历史记录失败' });
    }
});

// 获取单次运行详情
router.get('/history/:runId', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { runId } = req.params;

        const run = WorkflowService.getRunById(runId, userId);
        if (!run) {
            return res.status(404).json({ error: '记录不存在' });
        }

        const stepResults = WorkflowService.getStepResults(runId);
        res.json({ ...run, stepResults });
    } catch (error: any) {
        console.error('[Workflow] 获取运行详情失败:', error.message);
        res.status(500).json({ error: '获取运行详情失败' });
    }
});

// 删除运行记录
router.delete('/history/:runId', (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { runId } = req.params;

        const success = WorkflowService.deleteRun(runId, userId);
        if (!success) {
            return res.status(404).json({ error: '记录不存在或无权删除' });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[Workflow] 删除运行记录失败:', error.message);
        res.status(500).json({ error: '删除运行记录失败' });
    }
});

export default router;
