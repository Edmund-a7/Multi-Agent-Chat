# 快速开始

## 第一次运行

### 1. 启动服务

打开两个终端窗口：

**终端 1 - 启动后端:**
```bash
cd /Users/acumen7/wan/multi-agent-chat/server
npm run dev
```

**终端 2 - 启动前端:**
```bash
cd /Users/acumen7/wan/multi-agent-chat/client
npm run dev
```

### 2. 访问应用

打开浏览器访问: **http://localhost:5174** (或 5173)

### 3. 注册账号

1. 点击"注册"标签
2. 输入用户名（至少3个字符）
3. 输入密码（至少6个字符）
4. 确认密码
5. 点击"注册"

### 4. 开始使用

注册成功后会自动登录，你会看到欢迎页面！

---

## 已完成功能

✅ 用户注册和登录
✅ JWT 认证
✅ 自动保持登录状态
✅ 路由保护

## 下一步功能

⏳ 角色管理（创建不同的 AI 角色）
⏳ 聊天功能
⏳ @提及切换角色
⏳ AI 集成

---

## 技术栈

- **后端**: Express + TypeScript + SQLite + JWT
- **前端**: React 19 + TypeScript + Vite + Arco Design

---

完整文档请查看: [README.md](README.md)
