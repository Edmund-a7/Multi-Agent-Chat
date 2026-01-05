#!/bin/bash

# Multi-Agent Chat - 启动脚本

echo "🚀 启动 Multi-Agent Chat..."
echo ""

# 检查是否在项目根目录
if [ ! -d "server" ] || [ ! -d "client" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 启动后端服务器
echo "📡 启动后端服务器..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

# 等待服务器启动
sleep 3

# 启动前端应用
echo "🎨 启动前端应用..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

echo ""
echo "✅ 应用启动成功！"
echo ""
echo "📝 访问地址:"
echo "   前端: http://localhost:5173 (或 http://localhost:5174)"
echo "   后端: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "kill $SERVER_PID $CLIENT_PID; exit" INT
wait
