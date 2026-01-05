import axios from 'axios';
import { Database } from 'better-sqlite3';
import path from 'path';

import { WorkflowService } from '../services/WorkflowService';
import { AIService } from '../services/AIService';
import { initDatabase } from '../database';

async function verifyWorkflowService() {
    console.log('Starting Workflow Service Verification...');

    // 1. Initialize DB
    initDatabase();
    const userId = 'verify_user_' + Date.now();
    console.log('Test User ID:', userId);

    // Insert dummy user
    const dbPath = path.join(__dirname, '../../data/app.db');
    const db = require('better-sqlite3')(dbPath);
    try {
        db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
            userId, 'verify_user_' + Date.now(), 'hash', Date.now()
        );
    } catch (e) { console.warn('User insert failed', e); }

    // 2. Create Workflow
    console.log('\n--- Testing Create Workflow ---');
    const wf = WorkflowService.create(userId, 'Test Workflow', 'A test workflow');
    console.log('Created Workflow:', wf);
    if (wf.name !== 'Test Workflow') throw new Error('Workflow name mismatch');

    // 3. Add Steps
    console.log('\n--- Testing Add Steps ---');
    // Need a role first, let's assume we have none or create a dummy one if FK exists.
    // FK constraints might fail if role doesn't exist.
    // We need to insert a fake role into DB for testing strictly.
    const roleId = 'verify_role_' + Date.now();
    try {
        db.prepare('INSERT INTO roles (id, user_id, name, system_prompt, color, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            roleId, userId, 'Test Role', 'You are a test bot.', '#FF0000', 'gpt-3.5-turbo', Date.now()
        );
    } catch (e) {
        // role table might have different schema, let's check or just try.
        // If it fails, we know we need to adjust.
        console.warn('Could not insert test role directly, check schema if step creation fails.', e);
    }

    const steps = [
        { roleId: roleId, promptTemplate: 'Step 1 Prompt' },
        { roleId: roleId, promptTemplate: 'Step 2 Prompt' }
    ];

    const newSteps = WorkflowService.replaceSteps(wf.id, steps);
    console.log('Added Steps:', newSteps);
    if (newSteps.length !== 2) throw new Error('Step count mismatch');

    // 4. Get Workflow with Steps
    console.log('\n--- Testing Get Workflow ---');
    const wfFetched = WorkflowService.getById(wf.id, userId);
    const stepsFetched = WorkflowService.getSteps(wf.id);
    console.log('Fetched Workflow:', wfFetched);
    console.log('Fetched Steps:', stepsFetched);

    if (!wfFetched) throw new Error('Workflow not found');
    if (stepsFetched.length !== 2) throw new Error('Fetched step count mismatch');

    // 5. Create Run
    console.log('\n--- Testing Create Run ---');
    const run = WorkflowService.createRun(wf.id, userId, 'Initial Input');
    console.log('Created Run:', run);
    if (run.status !== 'running') throw new Error('Run status mismatch');

    // 6. Create Step Results
    console.log('\n--- Testing Create Step Results ---');
    const stepResults: any[] = [];
    for (const step of newSteps) {
        stepResults.push(WorkflowService.createStepResult(run.id, step.id, step.step_order, 'Test Role'));
    }
    console.log('Created Step Results:', stepResults);
    if (stepResults.length !== 2) throw new Error('Step results count mismatch');

    // 7. Update Step Result
    console.log('\n--- Testing Update Step Result ---');
    WorkflowService.updateStepResult(stepResults[0].id, { status: 'completed', outputText: 'Step 1 Output' });
    const updatedStepResult = WorkflowService.getStepResults(run.id).find((r: any) => r.id === stepResults[0].id);
    console.log('Updated Step Result:', updatedStepResult);
    if (updatedStepResult?.status !== 'completed') throw new Error('Step result update failed');

    // 8. Update Run
    console.log('\n--- Testing Update Run ---');
    WorkflowService.updateRun(run.id, { status: 'completed', finalResult: 'Final Output' });
    const updatedRun = WorkflowService.getRunById(run.id, userId);
    console.log('Updated Run:', updatedRun);
    if (updatedRun?.status !== 'completed') throw new Error('Run update failed');

    // 9. History
    console.log('\n--- Testing History ---');
    const history = WorkflowService.getRunHistory(userId, 10);
    console.log('History Count:', history.length);
    if (history.length === 0) throw new Error('History empty');

    // 10. Delete Workflow
    console.log('\n--- Testing Delete Workflow ---');
    const deleteResult = WorkflowService.delete(wf.id, userId);
    console.log('Delete Result:', deleteResult);
    if (!deleteResult) throw new Error('Delete failed');

    const wfDeleted = WorkflowService.getById(wf.id, userId);
    if (wfDeleted) throw new Error('Workflow still exists after delete');

    console.log('\nVerification Successful!');
}

verifyWorkflowService().catch(err => {
    console.error('Verification Failed:', err);
    process.exit(1);
});
