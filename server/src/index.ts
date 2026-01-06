import { createServer } from './server';
import { PORT } from './config/constants';

// 独立运行模式（非 Electron）
const port = Number(PORT);
createServer(port);

console.log(`\n可用的接口:`);
console.log(`  POST http://localhost:${port}/api/auth/register - 用户注册`);
console.log(`  POST http://localhost:${port}/api/auth/login - 用户登录`);
console.log(`  GET  http://localhost:${port}/api/roles - 获取角色列表（需要认证）`);
console.log(`  GET  http://localhost:${port}/api/conversations - 获取对话列表（需要认证）`);
console.log(`  POST http://localhost:${port}/api/conversations - 创建新对话（需要认证）`);
console.log(`\n按 Ctrl+C 停止服务器\n`);

