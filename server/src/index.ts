import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import rolesRoutes from './routes/roles';
import conversationsRoutes from './routes/conversations';
import chatRoutes from './routes/chat';
import aiConfigRoutes from './routes/aiConfig';
import uploadRoutes from './routes/upload';
import workflowRoutes from './routes/workflow';
import { PORT } from './config/constants';

// 加载环境变量
dotenv.config();

// 确保 data 目录存在
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库
initDatabase();

// 创建 Express 应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai-config', aiConfigRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/workflows', workflowRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 生产环境：提供静态文件
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));

  // SPA fallback - 所有非 API 路由返回 index.html
  app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicPath, 'index.html'));
    } else {
      res.status(404).json({ error: '路由不存在' });
    }
  });
} else {
  // 开发环境 404 处理
  app.use((req, res) => {
    res.status(404).json({ error: '路由不存在' });
  });
}

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 服务器启动成功！`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 API 地址: http://localhost:${PORT}/api`);
  console.log(`\n可用的接口:`);
  console.log(`  POST http://localhost:${PORT}/api/auth/register - 用户注册`);
  console.log(`  POST http://localhost:${PORT}/api/auth/login - 用户登录`);
  console.log(`  GET  http://localhost:${PORT}/api/roles - 获取角色列表（需要认证）`);
  console.log(`  GET  http://localhost:${PORT}/api/conversations - 获取对话列表（需要认证）`);
  console.log(`  POST http://localhost:${PORT}/api/conversations - 创建新对话（需要认证）`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});
