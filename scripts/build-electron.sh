#!/bin/bash

# Electron 生产打包脚本

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 开始 Electron 生产打包${NC}\n"

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  未找到 node_modules，正在安装依赖...${NC}"
    npm install
fi

# 构建所有组件
echo -e "${GREEN}🔨 构建后端...${NC}"
npm run build:server

echo -e "${GREEN}🔨 构建前端...${NC}"
npm run build:client

echo -e "${GREEN}🔨 构建 Electron 主进程...${NC}"
npm run build:electron

# 打包 Electron 应用
echo -e "${GREEN}📦 打包 Electron 应用...${NC}"

# 检查平台参数
# 检查平台参数
if [ "$1" = "mac" ]; then
    echo -e "${BLUE}🍎 为 macOS 打包...${NC}"
    npx electron-builder --mac
elif [ "$1" = "win" ]; then
    echo -e "${BLUE}🪟 为 Windows 打包...${NC}"
    npx electron-builder --win
elif [ "$1" = "linux" ]; then
    echo -e "${BLUE}🐧 为 Linux 打包...${NC}"
    npx electron-builder --linux
else
    echo -e "${BLUE}🌍 为当前平台打包...${NC}"
    npx electron-builder
fi

echo -e "${GREEN}✅ 打包完成！${NC}"
echo -e "${YELLOW}📂 安装包位置: release/${NC}"
