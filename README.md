# Multi-Agent Chat

一个支持多角色对话和工作流自动化的 AI Chat 应用。

## ✨ 特性

- 🤖 **多角色系统** - 创建不同角色，每个角色可配置独立的系统提示词和模型
- 🔄 **工作流引擎** - 将多个角色串联/并行执行，实现自动化处理流程
- 🖼️ **多模态支持** - 支持图片上传和视觉模型处理
- 🌓 **深色/浅色主题** - 支持主题切换
- 📱 **响应式设计** - 适配桌面和移动端

## 🚀 快速开始

### Docker 部署（推荐）

```bash
docker run -d \
  --name multi-agent-chat \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e JWT_SECRET=your-secret-key \
  ghcr.io/edmund-a7/multi-agent-chat:latest
```

#### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `-p 3000:3000` | 端口映射，格式：`宿主机端口:容器端口` | 改为 `-p 8080:3000` 则通过 8080 端口访问 |
| `-v ./data:/app/data` | 数据持久化，SQLite 数据库存储位置 | 可改为绝对路径如 `/home/user/chat-data:/app/data` |
| `-e JWT_SECRET=xxx` | 用户认证密钥，**务必修改为复杂字符串** | `JWT_SECRET=MySecretKey#2024!@#$` |

### 本地开发

```bash
# 克隆项目
git clone https://github.com/Edmund-a7/Multi-Agent-Chat.git
cd Multi-Agent-Chat

# 启动开发服务器
./start.sh
```

## ⚙️ 配置

首次使用需要：

1. 注册账号
2. 在设置页面配置 AI API（支持 OpenAI 兼容接口）
3. 创建角色开始对话

## 🛠️ 技术栈

- **前端**: React + TypeScript + Arco Design
- **后端**: Express + TypeScript + SQLite

## 📄 License

MIT

