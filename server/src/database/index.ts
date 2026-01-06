import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { User } from './types';

// 获取数据目录
function getDataDir(): string {
  // Electron 环境下使用传入的用户数据路径
  if (process.env.USER_DATA_PATH) {
    return process.env.USER_DATA_PATH;
  }
  // 默认使用相对路径
  return path.join(__dirname, '../../data');
}

const dataDir = getDataDir();

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表
export function initDatabase() {
  // Users 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Roles 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      color TEXT NOT NULL,
      model TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 尝试添加 model 列（如果在之前的版本中已存在表但不包含 model 列）
  try {
    db.exec(`ALTER TABLE roles ADD COLUMN model TEXT`);
  } catch (error) {
    // 忽略错误，如果列已经存在
  }

  // Conversations 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Messages 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role_id TEXT,
      content TEXT NOT NULL,
      position TEXT NOT NULL CHECK(position IN ('left', 'right')),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    )
  `);

  // AI Config 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      max_context_messages INTEGER NOT NULL DEFAULT 10,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Attachments 表（文件附件）
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      extracted_text TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `);

  // Workflows 表（工作流定义）
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Workflow Steps 表（工作流步骤）
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      parallel_group INTEGER DEFAULT 0,
      role_id TEXT NOT NULL,
      prompt_template TEXT,
      condition_expression TEXT,
      next_step_index INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing table if needed (simple check)
  try {
    db.prepare('SELECT condition_expression FROM workflow_steps LIMIT 1').get();
  } catch (e) {
    console.log('Migrating workflow_steps table...');
    try {
      db.exec('ALTER TABLE workflow_steps ADD COLUMN condition_expression TEXT');
      db.exec('ALTER TABLE workflow_steps ADD COLUMN next_step_index INTEGER');
    } catch (err) {
      console.warn('Migration warning:', err);
    }
  }


  // Workflow Runs 表（工作流运行记录）
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs(
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    input_text TEXT,
    final_result TEXT,
    status TEXT DEFAULT 'running',
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
    `);

  // Workflow Step Results 表（步骤执行结果）
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_step_results(
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      step_order INTEGER,
      role_name TEXT,
      input_text TEXT,
      output_text TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY(run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
    )
    `);

  console.log('✅ Database tables created successfully');
}

export default db;
