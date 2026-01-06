import { app } from 'electron';
import path from 'path';
import http from 'http';

let server: http.Server | null = null;
let serverPort: number = 3000;

/**
 * 启动后端服务器
 * @returns 服务器端口号
 */
export async function startServer(): Promise<number> {
    return new Promise((resolve, reject) => {
        const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

        if (isDev) {
            // 开发模式：假设后端已经单独运行
            console.log('开发模式：使用外部运行的后端服务器');
            resolve(3000);
            return;
        }

        // 生产模式：直接在主进程中启动服务器
        const userDataPath = app.getPath('userData');
        console.log('用户数据目录:', userDataPath);

        // 设置环境变量
        process.env.NODE_ENV = 'production';
        process.env.PORT = serverPort.toString();
        process.env.USER_DATA_PATH = userDataPath;

        try {
            // 动态加载后端服务器模块
            // 注意：在打包后，路径相对于 app.asar
            const serverModulePath = path.join(__dirname, '..', '..', 'server', 'dist', 'server.js');
            console.log('加载服务器模块:', serverModulePath);

            // 清除模块缓存确保重新加载
            delete require.cache[require.resolve(serverModulePath)];

            // 加载并启动服务器
            const { createServer } = require(serverModulePath);
            server = createServer(serverPort);

            // 延迟一点以确保服务器启动
            setTimeout(() => {
                console.log(`后端服务器已启动在端口: ${serverPort}`);
                resolve(serverPort);
            }, 1000);

        } catch (error) {
            console.error('服务器启动失败:', error);
            reject(error);
        }
    });
}

/**
 * 停止后端服务器
 */
export function stopServer() {
    if (server) {
        console.log('停止后端服务器...');
        server.close();
        server = null;
    }
}
