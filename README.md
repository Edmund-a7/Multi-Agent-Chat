<div align="center">

<img src="resources/icon.png" alt="Multi-Agent Chat" width="120" height="120">

# Multi-Agent Chat

**多角色 AI 对话与工作流自动化应用**

[![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)](https://github.com/Edmund-a7/Multi-Agent-Chat/releases)
[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB.svg)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Express-000000.svg)](https://expressjs.com/)
[![Desktop](https://img.shields.io/badge/Desktop-Electron-47848F.svg)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[功能特性](#功能特性) · [界面预览](#界面预览) · [安装指南](#安装指南) · [配置说明](#配置说明) · [技术架构](#技术架构)

**简体中文** | English (Coming Soon)

</div>

---

## 简介

Multi-Agent Chat 是一个支持多角色对话和工作流自动化的本地 AI Chat 应用。通过创建多个具有不同系统提示词的角色，并将它们组合成工作流，实现复杂任务的自动化处理。

## 功能特性

- **多角色系统** - 创建不同角色，每个角色可配置独立的系统提示词和模型
- **工作流引擎** - 将多个角色串联/并行执行，实现自动化处理流程
- **多模态支持** - 支持图片上传和视觉模型处理
- **主题切换** - 支持深色/浅色主题

## 界面预览

*待添加*

## 安装指南

### 本地部署

```bash
git clone https://github.com/Edmund-a7/Multi-Agent-Chat.git
cd Multi-Agent-Chat
./start.sh
```

访问 http://localhost:5173

### 桌面应用

#### macOS

从 [Releases](https://github.com/Edmund-a7/Multi-Agent-Chat/releases) 下载 `.dmg` 安装包。

或使用脚本打包：

```bash
./scripts/build-electron.sh mac
```

安装包位于 `release/` 目录。

#### Windows / Linux（待测试）

```bash
./scripts/build-electron.sh win    # Windows
./scripts/build-electron.sh linux  # Linux
```

### Docker（待测试）

```bash
docker run -d \
  --name multi-agent-chat \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e JWT_SECRET=your-secret-key \
  ghcr.io/edmund-a7/multi-agent-chat:latest
```

## 配置说明

1. 注册账号
2. 在设置页面配置 AI API（支持 OpenAI 兼容接口）
3. 创建角色开始对话

## 技术架构

| 组件 | 技术栈 |
|------|--------|
| 前端 | React + TypeScript + Arco Design |
| 后端 | Express + TypeScript + SQLite |
| 桌面 | Electron |

## License

[MIT](LICENSE)
