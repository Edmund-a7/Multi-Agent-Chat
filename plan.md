📋 计划概述
我为你设计了一个循序渐进的 8 阶段学习路径，让你边学边做：
🎯 核心策略
先 Web 后桌面: 从简单的 React + Express 开始，代码可以完全复用到后期的 Electron 版本
渐进式学习: 每个阶段专注一个核心概念，配合学习重点和参考资源
参考 AionUI: 借鉴其优秀的架构设计，但大幅简化复杂度
📚 8 个学习阶段
第一阶段 (1周): 项目搭建 + JWT 认证 → 学习 Node.js 基础
第二阶段 (1周): 角色管理系统 → 学习 CRUD 和表单处理
第三阶段 (1周): 基础聊天界面 → 学习 React 状态管理
第四阶段 (1周): OpenAI API 集成 → 学习异步编程和 API 调用
第五阶段 (1周): @提及功能 → 学习文本解析和正则表达式
第六阶段 (1周): 上下文管理 → 学习性能优化
第七阶段 (1周): UI 优化 → 学习用户体验设计
第八阶段 (可选): 流式响应、文件上传等高级功能
🏗️ 技术栈选择
保留 AionUI 的优点:
React 19 + TypeScript
Arco Design (UI 组件库)
Express + SQLite
Context API (状态管理)
简化的部分:
❌ 不用 Electron（先做 Web）
❌ 不用 UnoCSS（Arco 自带样式）
❌ 不用 WebSocket（先用 HTTP，后期可加）
❌ 不用复杂的 IPC 桥接
🎨 核心功能设计
你的应用相比 AionUI 的独特之处：
统一对话上下文: 多个角色在同一个对话中，共享历史记录
@提及切换角色: 用户可以 @Developer 或 @Designer 动态选择
更简单的架构: 直接调用 AI API，不需要包装 CLI 工具
📂 完整的文件结构
计划中包含了清晰的项目目录结构，每个文件的职责都很明确。
💡 学习资源
每个阶段都标注了：
学习重点
参考 AionUI 的对应文件路径
外部文档链接
现在你可以：
查看完整计划: moonlit-noodling-puffin.md
如果对某个阶段有疑问，随时问我
准备好后，我可以陪你一起实现第一阶段（项目搭建 + 认证）
你觉得这个计划怎么样？需要调整哪些部分吗？
Claude’s Plan
Multi-Agent Chat 项目 - 分步实现计划
项目概述
构建一个支持多角色对话的聊天应用，用户可以通过 @提及 不同角色（如 @Developer、@Designer），每个角色有独立的 system prompt，能看到完整的对话上下文。 技术栈: React 19 + TypeScript + Express + SQLite + Arco Design 策略: 先构建 Web 版本（更简单），代码可复用，后期可以用 Electron 包装成桌面应用
项目架构

multi-agent-chat/
├── server/                    # Express 后端
│   ├── src/
│   │   ├── database/         # SQLite 数据库层
│   │   │   ├── schema.ts     # 表定义 (users, conversations, messages, roles)
│   │   │   ├── index.ts      # 数据库初始化
│   │   │   └── types.ts      # 数据类型定义
│   │   ├── routes/           # API 路由
│   │   │   ├── auth.ts       # 登录/注册
│   │   │   ├── conversations.ts  # 对话 CRUD
│   │   │   ├── messages.ts   # 消息历史
│   │   │   ├── roles.ts      # 角色管理 CRUD
│   │   │   └── chat.ts       # 发送消息到 AI
│   │   ├── services/         # 业务逻辑
│   │   │   ├── AuthService.ts    # JWT + 密码加密
│   │   │   ├── AIService.ts      # OpenAI API 集成
│   │   │   └── ContextBuilder.ts # 上下文管理
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT 验证
│   │   │   └── errorHandler.ts
│   │   └── index.ts          # Express 启动入口
│   └── package.json
│
├── client/                    # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx     # 登录页
│   │   │   ├── Chat.tsx      # 主聊天界面
│   │   │   └── Settings.tsx  # 设置（API key、角色管理）
│   │   ├── components/
│   │   │   ├── MessageList.tsx      # 消息列表
│   │   │   ├── MessageInput.tsx     # 输入框（支持 @提及）
│   │   │   ├── RoleSelector.tsx     # 角色选择器
│   │   │   ├── ConversationList.tsx # 对话列表（侧边栏）
│   │   │   └── RoleManager.tsx      # 角色管理器
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx      # 认证状态
│   │   │   ├── ConversationContext.tsx  # 当前对话
│   │   │   └── RolesContext.tsx     # 可用角色列表
│   │   ├── services/
│   │   │   ├── api.ts        # Axios 实例
│   │   │   ├── authApi.ts    # 认证 API
│   │   │   ├── chatApi.ts    # 聊天 API
│   │   │   └── rolesApi.ts   # 角色 API
│   │   ├── types/            # TypeScript 类型定义
│   │   ├── utils/
│   │   │   └── mentionParser.ts  # 解析 @提及
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
└── README.md
数据模型
1. User (用户)

interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}
2. Role (角色)

interface Role {
  id: string;
  user_id: string;
  name: string;              // "Developer", "Designer" 等
  system_prompt: string;     // 定义角色的系统提示词
  color: string;             // UI 显示颜色（如 "#3370ff"）
  created_at: number;
}
3. Conversation (对话)

interface Conversation {
  id: string;
  user_id: string;
  name: string;              // 对话标题
  created_at: number;
  updated_at: number;
}
4. Message (消息)

interface Message {
  id: string;
  conversation_id: string;
  role_id?: string;          // NULL=用户消息，有值=AI 消息
  content: string;           // 消息内容
  position: 'left' | 'right'; // left=AI, right=用户
  created_at: number;
}
5. AIConfig (AI 配置)

interface AIConfig {
  base_url: string;          // 如 "https://api.openai.com/v1"
  api_key: string;           // API 密钥
  model: string;             // 模型名称（如 "gpt-4"）
  max_context_messages: number;  // 上下文消息数量限制
}
分阶段实现步骤
第一阶段：项目搭建 + 认证系统（学习：Node.js + Express + JWT）
目标: 搭建基础架构，实现用户登录功能 后端任务:
初始化 TypeScript + Express 项目
安装依赖: express, better-sqlite3, bcrypt, jsonwebtoken, cors, dotenv
创建数据库 schema（users 表）
实现 AuthService（密码加密、JWT 生成）
创建 auth 路由: POST /api/auth/register, POST /api/auth/login
添加 JWT 中间件验证
前端任务:
使用 Vite 创建 React + TypeScript 项目
安装依赖: @arco-design/web-react, axios, react-router-dom
创建 Login.tsx 登录页面（使用 Arco Design 的 Form 组件）
实现 AuthContext（管理登录状态、JWT token）
配置 React Router（/login, /chat 路由）
创建 api.ts axios 实例（自动附加 JWT token）
学习重点:
Express 路由和中间件
SQLite 数据库操作
JWT 认证原理
React Context API
TypeScript 基础类型
参考 AionUI 文件:
src/webserver/auth/ - 认证实现
src/renderer/context/AuthContext.tsx - 前端认证状态管理
第二阶段：角色系统（学习：CRUD 操作 + 表单处理）
目标: 创建和管理不同的对话角色 后端任务:
在 schema.ts 中添加 roles 表
创建 RoleService（CRUD 业务逻辑）
创建 roles 路由:
GET /api/roles - 获取角色列表
POST /api/roles - 创建新角色
PUT /api/roles/:id - 更新角色
DELETE /api/roles/:id - 删除角色
初始化 3 个默认角色:
Developer: "你是一个资深软件开发工程师..."
Designer: "你是一个 UX/UI 设计师..."
Product Manager: "你是一个产品经理..."
前端任务:
创建 RolesContext（管理角色列表状态）
创建 Settings.tsx 页面
实现 RoleManager.tsx 组件:
显示角色列表（Table 组件）
创建/编辑角色的 Modal（表单：名称、系统提示词、颜色选择器）
删除角色确认
创建 rolesApi.ts 服务（API 调用函数）
学习重点:
RESTful API 设计
SQL 外键关系
React 表单处理（受控组件）
Arco Design Table、Modal、Form 组件
状态管理（Context 模式）
参考 AionUI 文件:
src/process/database/schema.ts - 数据库表设计
src/renderer/pages/settings/ - 设置页面结构
第三阶段：基础聊天功能（学习：对话管理 + 消息渲染）
目标: 实现对话创建、消息发送和显示（暂不接入 AI） 后端任务:
在 schema.ts 中添加 conversations 和 messages 表
创建 conversations 路由:
GET /api/conversations - 获取对话列表
POST /api/conversations - 创建新对话
DELETE /api/conversations/:id - 删除对话
创建 messages 路由:
GET /api/conversations/:id/messages - 获取消息历史
POST /api/conversations/:id/messages - 添加用户消息（仅保存，不调用 AI）
前端任务:
创建 ConversationContext（当前对话 ID、消息列表）
创建 Chat.tsx 主页面（布局：侧边栏 + 聊天区）
实现 ConversationList.tsx（显示对话列表，点击切换）
实现 MessageList.tsx（显示消息，区分用户/AI，支持 Markdown）
实现 MessageInput.tsx（文本输入框 + 发送按钮）
集成 react-markdown 显示富文本消息
学习重点:
对话和消息的数据模型
列表渲染和条件渲染
组件间通信（通过 Context）
Markdown 渲染
时间格式化
参考 AionUI 文件:
src/renderer/context/ConversationContext.tsx
src/renderer/pages/conversation/ChatConversation.tsx
src/renderer/components/Markdown.tsx
第四阶段：AI 集成（学习：外部 API 调用 + 异步处理）
目标: 接入 OpenAI 兼容的 API，实现真正的 AI 对话 后端任务:
创建 AIService.ts:

async chat(
  systemPrompt: string,
  contextMessages: Message[],
  userMessage: string
): Promise<string>
在 schema.ts 添加 ai_config 表（存储 base_url, api_key, model）
创建 chat 路由:
POST /api/chat
请求体: { conversationId, roleId, message }
流程:
保存用户消息到数据库
获取角色的 system_prompt
获取对话历史（最近 N 条消息）
调用 AIService.chat()
保存 AI 回复到数据库
返回 AI 回复
使用 axios 调用 OpenAI API: POST /v1/chat/completions
前端任务:
在 Settings.tsx 添加 AI 配置表单:
API Base URL（默认 https://api.openai.com/v1）
API Key
Model 名称
修改 MessageInput.tsx:
发送按钮触发 API 调用
显示加载状态（Spin 组件）
错误处理（Message 提示）
更新 ConversationContext 添加 sendMessage 方法
MessageList 自动滚动到底部
学习重点:
HTTP 客户端（axios）
环境变量和配置管理
异步操作和 Promise
错误处理和用户反馈
OpenAI API 调用格式
参考:
OpenAI API 文档: https://platform.openai.com/docs/api-reference/chat
AionUI: src/process/bridge/geminiBridge.ts - AI 调用模式
第五阶段：@提及系统（学习：文本解析 + 动态角色切换）
目标: 实现 @RoleName 提及功能，支持在同一对话中切换角色 后端任务:
修改 POST /api/chat 路由:
从消息中解析 @mentions
提取最后一个 @提及的角色
使用该角色的 system_prompt
在保存消息时记录使用的 role_id
前端任务:
创建 mentionParser.ts 工具:

function parseMentions(text: string, roles: Role[]): {
  mentions: Role[],
  lastMention: Role | null
}
修改 MessageInput.tsx:
监听 "@" 输入
显示角色选择下拉框（AutoComplete 组件）
支持键盘导航选择角色
高亮显示 @提及
在 MessageList.tsx 中显示角色标识:
每条 AI 消息显示角色名称和颜色徽章
使用角色的 color 属性
学习重点:
正则表达式（解析 @mentions）
字符串处理
自动完成组件
动态样式（根据角色颜色）
UI 示例:

用户: @Developer 如何实现 React Context?
[Developer 图标] Developer: React Context 是一种...

用户: @Designer 这个按钮用什么颜色好?
[Designer 图标] Designer: 建议使用蓝色主题...
第六阶段：上下文管理（学习：性能优化 + 高级功能）
目标: 智能管理对话上下文，确保 AI 能看到历史消息 后端任务:
创建 ContextBuilder.ts:

buildContext(conversationId: string, maxMessages: number): Message[]
修改 AIService.chat():
构建完整的消息数组:

[
  { role: 'system', content: systemPrompt },
  ...历史消息,
  { role: 'user', content: newMessage }
]
在 ai_config 添加 max_context_messages 字段
前端任务:
在 Settings.tsx 添加上下文设置:
滑块选择上下文消息数量（5-50）
显示说明文字
（可选）显示 token 计数:
安装 tiktoken 库
显示每条消息的大约 token 数
警告接近模型限制时
学习重点:
上下文窗口概念
SQL 分页查询（LIMIT, ORDER BY）
性能优化（避免加载过多历史）
Token 计数原理
参考 AionUI 文件:
src/process/database/StreamingMessageBuffer.ts - 消息缓冲
第七阶段：UI 优化和错误处理（学习：用户体验 + 健壮性）
目标: 完善用户界面，处理边界情况 任务:
添加全局错误处理（ErrorBoundary）
完善加载状态（Skeleton 组件）
空状态提示（Empty 组件）
响应式布局（支持移动端）
深色模式切换（参考 AionUI ThemeContext）
消息时间戳显示
对话重命名功能
消息搜索功能
导出对话功能（JSON/Markdown）
学习重点:
错误边界（React Error Boundary）
响应式设计（CSS Media Query）
主题切换实现
用户体验优化
参考 AionUI 文件:
src/renderer/context/ThemeContext.tsx
src/renderer/components/base/ - 基础组件
第八阶段（可选）：高级特性
流式响应:
后端：使用 Server-Sent Events (SSE) 或 WebSocket
前端：实时显示 AI 生成的文本
参考：AionUI 的 WebSocket 实现
消息编辑:
编辑已发送的消息
重新生成 AI 回复
多轮对话分支:
从历史某条消息重新开始对话
树状对话结构
文件上传:
上传图片、文档
AI 分析文件内容
多语言支持:
i18next 国际化
中文/英文切换
核心技术点详解
1. @提及解析流程

// 前端: utils/mentionParser.ts
function parseMentions(text: string, roles: Role[]) {
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];

  const foundRoles = matches
    .map(m => roles.find(r =>
      r.name.toLowerCase() === m[1].toLowerCase()
    ))
    .filter(Boolean);

  return {
    mentions: foundRoles,
    lastMention: foundRoles[foundRoles.length - 1] || null
  };
}

// 使用示例
const text = "@Developer 帮我实现登录功能";
const { lastMention } = parseMentions(text, availableRoles);
// lastMention.system_prompt = "你是一个资深软件开发工程师..."
2. AI API 调用结构

// 后端: services/AIService.ts
async chat(systemPrompt: string, context: Message[], userMsg: string) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.map(m => ({
      role: m.position === 'right' ? 'user' : 'assistant',
      content: m.content
    })),
    { role: 'user', content: userMsg }
  ];

  const response = await axios.post(
    `${this.config.base_url}/chat/completions`,
    { model: this.config.model, messages },
    { headers: { 'Authorization': `Bearer ${this.config.api_key}` }}
  );

  return response.data.choices[0].message.content;
}
3. 上下文构建策略

// 后端: services/ContextBuilder.ts
buildContext(conversationId: string, maxMessages: number = 10) {
  // 获取最近的 N 条消息（降序）
  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(conversationId, maxMessages);

  // 反转为时间正序
  return messages.reverse();
}
关键文件列表
后端核心文件
server/src/index.ts - Express 服务器入口
server/src/database/schema.ts - 数据库表定义
server/src/services/AIService.ts - AI API 集成
server/src/routes/chat.ts - 聊天路由（最核心）
server/src/middleware/auth.ts - JWT 认证中间件
前端核心文件
client/src/pages/Chat.tsx - 主聊天页面
client/src/components/MessageInput.tsx - 输入框（@提及）
client/src/components/MessageList.tsx - 消息列表
client/src/contexts/ConversationContext.tsx - 对话状态管理
client/src/utils/mentionParser.ts - @提及解析器
学习资源
TypeScript 基础:
官方文档: https://www.typescriptlang.org/docs/
重点学习: 接口、类型、泛型
React 19:
官方文档: https://react.dev/
重点学习: Hooks (useState, useEffect, useContext), Context API
Express.js:
官方文档: https://expressjs.com/
重点学习: 路由、中间件、错误处理
SQLite:
better-sqlite3 文档: https://github.com/WiseLibs/better-sqlite3
重点学习: CRUD 操作、外键关系
Arco Design:
官方文档: https://arco.design/react/docs/start
重点学习: Form, Table, Modal, Message 组件
OpenAI API:
官方文档: https://platform.openai.com/docs/api-reference/chat
重点学习: Chat Completions API 格式
AionUI 参考对照
你的应用	AionUI 对应部分	说明
Role 系统	不同的 Agent 类型 (gemini, acp, codex)	你的更简单，直接切换 system prompt
@提及解析	-	新功能，AionUI 没有
统一对话上下文	每个 Agent 独立会话	你的设计允许多角色共享上下文
Web 优先	Electron 优先	你从简单开始，后续可添加 Electron
直接 API 调用	包装 CLI 工具	你的架构更简单
参考 AionUI 学习:
数据库设计: src/process/database/schema.ts
认证系统: src/webserver/auth/
对话状态管理: src/renderer/context/ConversationContext.tsx
消息显示: src/renderer/pages/conversation/
设置页面: src/renderer/pages/settings/
项目时间线（参考）
第 1 周: 项目搭建 + 认证（第一阶段）
第 2 周: 角色系统（第二阶段）
第 3 周: 基础聊天（第三阶段）
第 4 周: AI 集成（第四阶段）
第 5 周: @提及系统（第五阶段）
第 6 周: 上下文管理（第六阶段）
第 7 周: UI 优化（第七阶段）
第 8 周+: 可选高级功能（第八阶段）
后续扩展：Electron 桌面版
当 Web 版本完成后，可以添加 Electron 包装：
安装 Electron Forge（和 AionUI 相同）
创建 src/main.ts 主进程
创建 src/preload.ts 预加载脚本
在主进程中启动 Express 服务器
BrowserWindow 加载前端页面
添加 IPC 通信（文件系统操作等）
打包分发
参考:
AionUi/src/index.ts - Electron 主进程
AionUi/src/preload.ts - IPC 桥接
AionUi/forge.config.ts - 打包配置
