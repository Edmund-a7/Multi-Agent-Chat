import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import rolesRoutes from './routes/roles';
import conversationsRoutes from './routes/conversations';
import chatRoutes from './routes/chat';
import aiConfigRoutes from './routes/aiConfig';
import uploadRoutes from './routes/upload';
import workflowRoutes from './routes/workflow';

// 加载环境变量
dotenv.config();

// 获取数据目录
function getDataDir(): string {
    if (process.env.USER_DATA_PATH) {
        return process.env.USER_DATA_PATH;
    }
    return path.join(__dirname, '../data');
}

// 获取静态文件目录
function getPublicPath(): string {
    // Electron 打包后，静态文件在 client/dist 目录
    if (process.env.USER_DATA_PATH) {
        // 打包模式：相对于当前模块路径
        return path.join(__dirname, '../../client/dist');
    }
    return path.join(__dirname, '../public');
}

// 创建并配置 Express 应用
function createApp() {
    const dataDir = getDataDir();

    // 确保 data 目录存在
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
        const publicPath = getPublicPath();
        console.log('静态文件目录:', publicPath);

        if (fs.existsSync(publicPath)) {
            app.use(express.static(publicPath));

            // SPA fallback
            app.use((req, res) => {
                if (!req.path.startsWith('/api')) {
                    res.sendFile(path.join(publicPath, 'index.html'));
                } else {
                    res.status(404).json({ error: '路由不存在' });
                }
            });
        } else {
            console.warn('警告: 静态文件目录不存在:', publicPath);
        }
    } else {
        app.use((req, res) => {
            res.status(404).json({ error: '路由不存在' });
        });
    }

    // 错误处理
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Error:', err);
        res.status(500).json({ error: '服务器内部错误' });
    });

    return app;
}

/**
 * 创建并启动服务器（供 Electron 调用）
 */
export function createServer(port: number = 3000): http.Server {
    const app = createApp();
    const server = http.createServer(app);

    server.listen(port, () => {
        console.log(`\n🚀 服务器启动成功！`);
        console.log(`📡 端口: ${port}`);
        console.log(`🌐 API 地址: http://localhost:${port}/api\n`);
    });

    return server;
}

// 导出 app 供测试使用
export const app = createApp();
export default app;
