import axios from 'axios';
import jwt from 'jsonwebtoken';
// import db from '../database';
const db = require('../database').default || require('../database').db;
import { randomUUID } from 'crypto';

// Configuration
const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const USER_ID = 'verify_cond_user';
const WORKFLOW_ID = 'verify_cond_wf';
const ROLE_ID = 'verify_role';

async function setupData() {
    console.log('1. Setting up test data...');

    // Clean up old data
    db.prepare('DELETE FROM users WHERE id = ?').run(USER_ID);
    db.prepare('DELETE FROM roles WHERE user_id = ?').run(USER_ID);
    db.prepare('DELETE FROM workflows WHERE id = ?').run(WORKFLOW_ID);
    // Cascade delete should handle steps/runs, but let's be safe if not configured
    db.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(WORKFLOW_ID);
    db.prepare('DELETE FROM ai_config WHERE user_id = ?').run(USER_ID);

    // Insert User
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
        USER_ID, 'verifier', 'pass_hash', Date.now()
    );

    // Insert AI Config for Mock
    // Using mock-echo model to get deterministic output matching the prompt
    db.prepare('INSERT INTO ai_config (id, user_id, base_url, api_key, model, max_context_messages) VALUES (?, ?, ?, ?, ?, ?)').run(
        randomUUID(), USER_ID, 'http://mock', 'mock_key', 'mock-echo', 10
    );

    // Insert Role
    db.prepare('INSERT INTO roles (id, user_id, name, system_prompt, color, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        ROLE_ID, USER_ID, 'EchoBot', 'Echo', '#000000', Date.now()
    );

    // Insert Workflow
    db.prepare('INSERT INTO workflows (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
        WORKFLOW_ID, USER_ID, 'Conditional Flow', Date.now(), Date.now()
    );

    // Insert Steps
    // Step 1: Prompt "ERROR". Condition "ERROR" -> Jump to Step 3.
    // Note: next_step_index refers to step_order (1-based index usually used in UI/Logic).
    // Our logic uses: steps.findIndex(s => s.step_order === lastStepInBlock.next_step_index)

    // Step 1 (Order 1)
    db.prepare(`
        INSERT INTO workflow_steps (id, workflow_id, step_order, role_id, prompt_template, condition_expression, next_step_index, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        'step_1', WORKFLOW_ID, 1, ROLE_ID, 'ERROR', 'ERROR', 3, Date.now()
    );

    // Step 2 (Order 2) - Should be SKIPPED
    db.prepare(`
        INSERT INTO workflow_steps (id, workflow_id, step_order, role_id, prompt_template, created_at) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        'step_2', WORKFLOW_ID, 2, ROLE_ID, 'SKIP_ME', Date.now()
    );

    // Step 3 (Order 3) - Final Step
    db.prepare(`
        INSERT INTO workflow_steps (id, workflow_id, step_order, role_id, prompt_template, created_at) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        'step_3', WORKFLOW_ID, 3, ROLE_ID, 'FINAL', Date.now()
    );

    console.log('   Data setup complete.');
}

async function runTest() {
    await setupData();

    console.log('2. Generating Token...');
    const token = jwt.sign({ userId: USER_ID, username: 'verifier' }, JWT_SECRET);

    console.log('3. Executing Workflow via API...');
    try {
        const response = await axios.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/run`,
            { input: 'Start' },
            {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'stream',
                timeout: 10000
            }
        );

        const stream = response.data;
        let buffer = '';
        let stepEvents: any[] = [];

        stream.on('data', (chunk: Buffer) => {
            const str = chunk.toString();
            buffer += str;
            // Parse events loosely
            const lines = str.split('\n');
            for (const line of lines) {
                if (line.startsWith('event: step_complete')) {
                    // followed by data: {...}
                }
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.output) {
                            stepEvents.push(data);
                            console.log('   -> Step Complete Output:', data.output);
                        }
                    } catch (e) { }
                }
            }
        });

        stream.on('end', () => {
            console.log('4. Stream ended. Verifying results...');
            console.log('   Full Buffer Length:', buffer.length);

            // output from mock-echo should include the prompt
            // Step 1 input: "ERROR\n\nStart" -> Output: "ERROR\n\nStart"
            // Step 2 input: "SKIP_ME\n\n..." -> Output: "SKIP_ME..." (If executed)
            // Step 3 input: "FINAL\n\n..." -> Output: "FINAL..."

            const step1Executed = buffer.includes('ERROR');
            const step2Executed = buffer.includes('SKIP_ME');
            const step3Executed = buffer.includes('FINAL');

            console.log('   Step 1 Executed (Expected TRUE):', step1Executed);
            console.log('   Step 2 Executed (Expected FALSE):', step2Executed);
            console.log('   Step 3 Executed (Expected TRUE):', step3Executed);

            if (step1Executed && !step2Executed && step3Executed) {
                console.log('✅ SUCCESS: Conditional Jump Verified!');
                process.exit(0);
            } else {
                console.error('❌ FAILURE: Execution flow did not match expectations.');
                process.exit(1);
            }
        });

        stream.on('error', (err: any) => {
            console.error('Stream Error:', err);
            process.exit(1);
        });

    } catch (e: any) {
        console.error('Request Failed:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', e.response.data);
        }
        process.exit(1);
    }
}

runTest();
