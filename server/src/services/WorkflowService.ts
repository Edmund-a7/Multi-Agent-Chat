import db from '../database';
import { randomUUID } from 'crypto';

// 类型定义
export interface Workflow {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    created_at: number;
    updated_at: number;
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
    created_at: number;
    // 关联数据
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
    // 关联数据
    workflow_name?: string;
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

export class WorkflowService {
    // ===== 工作流 CRUD =====

    static create(userId: string, name: string, description?: string): Workflow {
        const id = randomUUID();
        const now = Date.now();

        db.prepare(`
      INSERT INTO workflows (id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, description || null, now, now);

        return { id, user_id: userId, name, description, created_at: now, updated_at: now };
    }

    static getAll(userId: string): Workflow[] {
        return db.prepare(`
      SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC
    `).all(userId) as Workflow[];
    }

    static getById(id: string, userId: string): Workflow | null {
        return db.prepare(`
      SELECT * FROM workflows WHERE id = ? AND user_id = ?
    `).get(id, userId) as Workflow | null;
    }

    static update(id: string, userId: string, data: { name?: string; description?: string }): boolean {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.name) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            values.push(data.description);
        }
        updates.push('updated_at = ?');
        values.push(Date.now());

        values.push(id, userId);

        const result = db.prepare(`
      UPDATE workflows SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values);

        return result.changes > 0;
    }

    static delete(id: string, userId: string): boolean {
        const result = db.prepare(`
      DELETE FROM workflows WHERE id = ? AND user_id = ?
    `).run(id, userId);
        return result.changes > 0;
    }

    // ===== 工作流步骤 CRUD =====

    static addStep(workflowId: string, roleId: string, stepOrder: number, promptTemplate?: string, parallelGroup: number = 0, conditionExpression?: string, nextStepIndex?: number): WorkflowStep {
        const id = randomUUID();
        const now = Date.now();

        db.prepare(`
      INSERT INTO workflow_steps (id, workflow_id, step_order, parallel_group, role_id, prompt_template, condition_expression, next_step_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, workflowId, stepOrder, parallelGroup, roleId, promptTemplate || null, conditionExpression || null, nextStepIndex || null, now);

        return {
            id, workflow_id: workflowId, step_order: stepOrder, parallel_group: parallelGroup, role_id: roleId, prompt_template: promptTemplate,
            condition_expression: conditionExpression, next_step_index: nextStepIndex, created_at: now
        };
    }

    static getSteps(workflowId: string): WorkflowStep[] {
        return db.prepare(`
      SELECT ws.*, r.name as role_name, r.color as role_color
      FROM workflow_steps ws
      LEFT JOIN roles r ON ws.role_id = r.id
      WHERE ws.workflow_id = ?
      ORDER BY ws.step_order ASC
    `).all(workflowId) as WorkflowStep[];
    }

    static updateStep(stepId: string, data: { roleId?: string; promptTemplate?: string; stepOrder?: number; parallelGroup?: number; conditionExpression?: string; nextStepIndex?: number }): boolean {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.roleId) {
            updates.push('role_id = ?');
            values.push(data.roleId);
        }
        if (data.promptTemplate !== undefined) {
            updates.push('prompt_template = ?');
            values.push(data.promptTemplate);
        }
        if (data.stepOrder !== undefined) {
            updates.push('step_order = ?');
            values.push(data.stepOrder);
        }
        if (data.parallelGroup !== undefined) {
            updates.push('parallel_group = ?');
            values.push(data.parallelGroup);
        }
        if (data.conditionExpression !== undefined) {
            updates.push('condition_expression = ?');
            values.push(data.conditionExpression);
        }
        if (data.nextStepIndex !== undefined) {
            updates.push('next_step_index = ?');
            values.push(data.nextStepIndex);
        }

        if (updates.length === 0) return false;

        values.push(stepId);
        const result = db.prepare(`
      UPDATE workflow_steps SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

        return result.changes > 0;
    }

    static deleteStep(stepId: string): boolean {
        const result = db.prepare(`DELETE FROM workflow_steps WHERE id = ?`).run(stepId);
        return result.changes > 0;
    }

    static deleteAllSteps(workflowId: string): void {
        db.prepare(`DELETE FROM workflow_steps WHERE workflow_id = ?`).run(workflowId);
    }

    // ===== 批量更新步骤（用于编辑器保存）=====

    static replaceSteps(workflowId: string, steps: { roleId: string; promptTemplate?: string; parallelGroup?: number; conditionExpression?: string; nextStepIndex?: number }[]): WorkflowStep[] {
        // 删除旧步骤
        this.deleteAllSteps(workflowId);

        // 添加新步骤
        return steps.map((step, index) =>
            this.addStep(workflowId, step.roleId, index + 1, step.promptTemplate, step.parallelGroup || 0, step.conditionExpression, step.nextStepIndex)
        );
    }

    // ===== 运行记录 =====

    static createRun(workflowId: string, userId: string, inputText: string): WorkflowRun {
        const id = randomUUID();
        const now = Date.now();

        db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, user_id, input_text, status, started_at)
      VALUES (?, ?, ?, ?, 'running', ?)
    `).run(id, workflowId, userId, inputText, now);

        return { id, workflow_id: workflowId, user_id: userId, input_text: inputText, status: 'running', started_at: now };
    }

    static updateRun(runId: string, data: { status?: string; finalResult?: string; completedAt?: number }): boolean {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.status) {
            updates.push('status = ?');
            values.push(data.status);
        }
        if (data.finalResult !== undefined) {
            updates.push('final_result = ?');
            values.push(data.finalResult);
        }
        if (data.completedAt) {
            updates.push('completed_at = ?');
            values.push(data.completedAt);
        }

        if (updates.length === 0) return false;

        values.push(runId);
        const result = db.prepare(`UPDATE workflow_runs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        return result.changes > 0;
    }

    static getRunHistory(userId: string, limit: number = 20): WorkflowRun[] {
        return db.prepare(`
      SELECT wr.*, w.name as workflow_name
      FROM workflow_runs wr
      LEFT JOIN workflows w ON wr.workflow_id = w.id
      WHERE wr.user_id = ?
      ORDER BY wr.started_at DESC
      LIMIT ?
    `).all(userId, limit) as WorkflowRun[];
    }

    static getRunById(runId: string, userId: string): WorkflowRun | null {
        return db.prepare(`
      SELECT wr.*, w.name as workflow_name
      FROM workflow_runs wr
      LEFT JOIN workflows w ON wr.workflow_id = w.id
      WHERE wr.id = ? AND wr.user_id = ?
    `).get(runId, userId) as WorkflowRun | null;
    }

    static deleteRun(runId: string, userId: string): boolean {
        // First verify ownership
        const run = this.getRunById(runId, userId);
        if (!run) {
            return false;
        }

        // Delete step results first (foreign key constraint)
        db.prepare(`DELETE FROM workflow_step_results WHERE run_id = ?`).run(runId);

        // Delete the run
        db.prepare(`DELETE FROM workflow_runs WHERE id = ? AND user_id = ?`).run(runId, userId);

        return true;
    }

    // ===== 步骤执行结果 =====

    static createStepResult(runId: string, stepId: string, stepOrder: number, roleName: string): WorkflowStepResult {
        const id = randomUUID();

        db.prepare(`
      INSERT INTO workflow_step_results (id, run_id, step_id, step_order, role_name, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(id, runId, stepId, stepOrder, roleName);

        return { id, run_id: runId, step_id: stepId, step_order: stepOrder, role_name: roleName, status: 'pending' };
    }

    static updateStepResult(resultId: string, data: {
        status?: string;
        inputText?: string;
        outputText?: string;
        errorMessage?: string;
        startedAt?: number;
        completedAt?: number;
    }): boolean {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.status) { updates.push('status = ?'); values.push(data.status); }
        if (data.inputText !== undefined) { updates.push('input_text = ?'); values.push(data.inputText); }
        if (data.outputText !== undefined) { updates.push('output_text = ?'); values.push(data.outputText); }
        if (data.errorMessage !== undefined) { updates.push('error_message = ?'); values.push(data.errorMessage); }
        if (data.startedAt) { updates.push('started_at = ?'); values.push(data.startedAt); }
        if (data.completedAt) { updates.push('completed_at = ?'); values.push(data.completedAt); }

        if (updates.length === 0) return false;

        values.push(resultId);
        const result = db.prepare(`UPDATE workflow_step_results SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        return result.changes > 0;
    }

    static getStepResults(runId: string): WorkflowStepResult[] {
        return db.prepare(`
      SELECT * FROM workflow_step_results WHERE run_id = ? ORDER BY step_order ASC
    `).all(runId) as WorkflowStepResult[];
    }
}
