
import { WorkflowService, Workflow, WorkflowStep } from '../services/WorkflowService';
import db, { initDatabase } from '../database';
import path from 'path';

async function verifyParallelWorkflow() {
    console.log('Starting Parallel Workflow Verification...');

    // 1. Initialize DB
    initDatabase();
    const userId = 'verify_user_parallel_' + Date.now();
    console.log('Test User ID:', userId);

    // Insert dummy user
    const dbPath = path.join(__dirname, '../../data/app.db');
    const dbInstance = require('better-sqlite3')(dbPath);
    try {
        dbInstance.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
            userId, userId, 'hash', Date.now() // Use userId as username for uniqueness
        );
    } catch (e) { console.warn('User insert failed', e); }

    // 2. Create Workflow
    console.log('\n--- Testing Create Workflow ---');
    const workflow = WorkflowService.create(userId, 'Parallel Test', 'Testing parallel steps');
    console.log('Created Workflow ID:', workflow.id);

    // 3. Insert dummy role
    const roleId = 'verify_role_parallel_' + Date.now();
    try {
        dbInstance.prepare('INSERT INTO roles (id, user_id, name, system_prompt, color, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            roleId, userId, 'Parallel Role', 'You are a test bot.', '#00FF00', 'gpt-3.5-turbo', Date.now()
        );
    } catch (e) {
        console.warn('Role insert failed', e);
    }

    // 4. Add Parallel Steps
    console.log('\n--- Testing Add Parallel Steps ---');
    // Step 1: Serial
    // Step 2 & 3: Parallel (Group 1)
    // Step 4: Serial

    WorkflowService.replaceSteps(workflow.id, [
        { roleId, promptTemplate: 'Step 1 (Serial)', parallelGroup: 0 },
        { roleId, promptTemplate: 'Step 2 (Parallel A)', parallelGroup: 1 },
        { roleId, promptTemplate: 'Step 3 (Parallel B)', parallelGroup: 1 },
        { roleId, promptTemplate: 'Step 4 (Serial)', parallelGroup: 0 }
    ]);

    const steps = WorkflowService.getSteps(workflow.id);
    console.log('Added Steps:', steps.map(s => ({ order: s.step_order, group: s.parallel_group, tpl: s.prompt_template })));

    if (steps.length !== 4) throw new Error('Steps count mismatch');
    if (steps[1].parallel_group !== 1 || steps[2].parallel_group !== 1) throw new Error('Parallel group mismatch');

    // Note: We cannot easily test the actual "execution" here because it relies on AIService calling OpenAI/Mock.
    // However, we can Verify the grouping logic in `workflow.ts` by code review or by mocking AIService if we wanted to run a full integration test.
    // For now, this script confirms we can store and retrieve parallel steps correctly.

    console.log('\nVerification Successful! (Storage logic confirmed)');

    // Cleanup
    WorkflowService.delete(workflow.id, userId);
}

verifyParallelWorkflow().catch(console.error);
