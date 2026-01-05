import axios from 'axios';

const API_URL = '/api/workflows';

// 类型定义（与后端对应）
export interface Workflow {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    created_at: number;
    updated_at: number;
    steps?: WorkflowStep[];
}

export interface WorkflowStep {
    id: string;
    workflow_id: string;
    step_order: number;
    parallel_group: number;
    role_id: string;
    prompt_template?: string;
    condition_expression?: string;
    next_step_index?: number;
    role_name?: string;
    role_color?: string;
}

export interface WorkflowRun {
    id: string;
    workflow_id: string;
    user_id: string;
    input_text?: string;
    final_result?: string;
    status: 'running' | 'completed' | 'failed';
    started_at: number;
    completed_at?: number;
    workflow_name?: string;
    stepResults?: WorkflowStepResult[];
}

export interface WorkflowStepResult {
    id: string;
    run_id: string;
    step_id: string;
    step_order: number;
    role_name?: string;
    input_text?: string;
    output_text?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    error_message?: string;
    started_at?: number;
    completed_at?: number;
}

const getAuthToken = () => localStorage.getItem('token');

const getHeaders = () => {
    const token = getAuthToken();
    return {
        Authorization: `Bearer ${token}`,
    };
};

export const WorkflowService = {
    // 获取所有工作流
    getAll: async (): Promise<Workflow[]> => {
        const response = await axios.get(API_URL, { headers: getHeaders() });
        return response.data;
    },

    // 获取单个工作流详情
    getById: async (id: string): Promise<Workflow> => {
        const response = await axios.get(`${API_URL}/${id}`, { headers: getHeaders() });
        return response.data;
    },

    // 创建工作流
    create: async (name: string, description?: string): Promise<Workflow> => {
        const response = await axios.post(API_URL, { name, description }, { headers: getHeaders() });
        return response.data;
    },

    // 更新工作流
    update: async (id: string, data: { name?: string; description?: string; steps?: any[] }): Promise<Workflow> => {
        const response = await axios.put(`${API_URL}/${id}`, data, { headers: getHeaders() });
        return response.data;
    },

    // 删除工作流
    delete: async (id: string): Promise<boolean> => {
        const response = await axios.delete(`${API_URL}/${id}`, { headers: getHeaders() });
        return response.data.success;
    },

    // 获取历史记录
    getHistory: async (limit: number = 20): Promise<WorkflowRun[]> => {
        const response = await axios.get(`${API_URL}/history/list`, {
            params: { limit },
            headers: getHeaders()
        });
        return response.data;
    },

    // 获取运行详情
    getRunDetail: async (runId: string): Promise<WorkflowRun> => {
        const response = await axios.get(`${API_URL}/history/${runId}`, { headers: getHeaders() });
        return response.data;
    },

    // 删除运行记录
    deleteRun: async (runId: string): Promise<boolean> => {
        const response = await axios.delete(`${API_URL}/history/${runId}`, { headers: getHeaders() });
        return response.data.success;
    },

    // 运行工作流（SSE 流式）
    runWorkflowStream: async (
        workflowId: string,
        input: string,
        onEvent: (event: string, data: any) => void,
        signal?: AbortSignal
    ) => {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/${workflowId}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ input }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = '运行失败';
            try {
                errorMessage = JSON.parse(errorText).error;
            } catch (e) { }
            throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('无法读取响应流');

        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const eventMatch = line.match(/^event: (.+)$/m);
                    const dataMatch = line.match(/^data: (.+)$/m);

                    if (eventMatch && dataMatch) {
                        const event = eventMatch[1].trim();
                        const dataStr = dataMatch[1].trim();
                        try {
                            const data = JSON.parse(dataStr);
                            onEvent(event, data);
                        } catch (e) {
                            console.error('解析 SSE 数据失败:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
};
