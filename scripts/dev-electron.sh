#!/bin/bash

# Electron 开发模式启动脚本

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 启动 Electron 开发模式${NC}\n"

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  未找到 node_modules，正在安装依赖...${NC}"
    npm install
fi

# 编译 Electron 主进程代码
echo -e "${GREEN}📦 编译 Electron 主进程代码...${NC}"
npm run build:electron

# 编译后端代码
echo -e "${GREEN}📦 编译后端代码...${NC}"
cd server && npm run build && cd ..

# 启动后端服务器（后台）
echo -e "${GREEN}🔧 启动后端服务器...${NC}"
cd server && npm run start &
SERVER_PID=$!

# 等待后端启动
sleep 2

# 启动前端开发服务器（后台）
echo -e "${GREEN}🎨 启动前端开发服务器...${NC}"
cd client && npm run dev &
CLIENT_PID=$!

# 等待前端启动
sleep 3

# 启动 Electron
echo -e "${GREEN}⚡ 启动 Electron 应用...${NC}"
NODE_ENV=development npx electron .

# Electron 关闭后，清理后台进程
echo -e "${YELLOW}🛑 清理后台进程...${NC}"
kill $SERVER_PID 2>/dev/null
kill $CLIENT_PID 2>/dev/null

echo -e "${GREEN}✅ Electron 开发模式已退出${NC}"
