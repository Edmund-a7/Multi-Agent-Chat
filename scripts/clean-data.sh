#!/bin/bash

# 清理本地数据脚本

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  警告：此操作将永久删除所有本地对话记录、账号和上传的文件！${NC}"
read -p "确认要继续吗？ (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}已取消操作${NC}"
    exit 1
fi

echo -e "\n${GREEN}🧹 开始清理...${NC}"

# 清理数据库
if [ -d "server/data" ]; then
    rm -rf server/data/*.db
    rm -rf server/data/*.db-shm
    rm -rf server/data/*.db-wal
    echo -e "✅ 已删除数据库文件"
else
    echo -e "ℹ️  未发现数据库目录"
fi

# 清理上传文件
if [ -d "server/uploads" ]; then
    rm -rf server/uploads/*
    echo -e "✅ 已删除上传文件"
else
    echo -e "ℹ️  未发现上传目录"
fi

echo -e "${GREEN}✨ 清理完成。下次启动时将生成全新的账号和数据。${NC}"
