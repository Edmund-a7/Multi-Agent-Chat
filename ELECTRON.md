# Electron 桌面应用说明

## 概述

本项目已支持打包为跨平台的 Electron 桌面应用，可在 Windows、macOS 和 Linux 上运行。

## 架构说明

### 整体架构

```
Electron App
├─ 主进程（Main Process）
│  ├─ 启动 Express 后端服务
│  ├─ 管理应用窗口
│  └─ 系统托盘和菜单
└─ 渲染进程（Renderer Process）
   └─ React 前端应用
```

### 关键特性

- ✅ **本地数据存储** - 数据库和上传文件存储在用户数据目录
- ✅ **系统托盘** - 支持最小化到托盘，快速唤起应用
- ✅ **跨平台** - 支持 Windows、macOS、Linux
- ✅ **离线可用** - 无需外部服务器，完全独立运行

## 开发模式

### 启动开发环境

```bash
./scripts/dev-electron.sh
```

该脚本会：
1. 编译 Electron 主进程代码
2. 编译后端代码
3. 启动后端服务器
4. 启动前端开发服务器（支持热更新）
5. 启动 Electron 窗口

### 调试

- 开发模式下会自动打开 DevTools
- 前端支持热更新，无需重启应用
- 后端修改需要重新运行启动脚本

## 生产打包

### 打包命令

```bash
# 为当前平台打包
./scripts/build-electron.sh

# 为特定平台打包
./scripts/build-electron.sh mac    # macOS (.dmg, .zip)
./scripts/build-electron.sh win    # Windows (.exe, portable)
./scripts/build-electron.sh linux  # Linux (.AppImage, .deb)
```

### 打包产物

打包后的安装包位于 `release/` 目录：

- **macOS**: `Multi-Agent Chat-1.0.0-mac-arm64.dmg` 或 `Multi-Agent Chat-1.0.0-mac-x64.dmg`
- **Windows**: `Multi-Agent Chat-1.0.0-win-x64.exe` (安装版) 和便携版
- **Linux**: `Multi-Agent Chat-1.0.0-linux-x64.AppImage` 和 `.deb` 包

## 数据存储位置

应用数据存储在系统用户数据目录：

- **macOS**: `~/Library/Application Support/multi-agent-chat/`
- **Windows**: `%APPDATA%/multi-agent-chat/`
- **Linux**: `~/.config/multi-agent-chat/`

包含：
- `app.db` - SQLite 数据库
- `uploads/` - 用户上传的文件

## 项目结构

```
multi-agent-chat/
├── electron/              # Electron 主进程代码
│   ├── main.ts           # 应用入口
│   ├── preload.ts        # 预加载脚本
│   └── server.ts         # 后端服务器管理
├── client/               # React 前端
├── server/               # Express 后端
├── resources/            # 应用资源（图标等）
├── scripts/              # 开发和打包脚本
├── package.json          # 根项目配置
└── tsconfig.electron.json # Electron TS 配置
```

## 常见问题

### Q: 如何更改应用图标？

替换 `resources/` 目录下的图标文件：
- `icon.png` - Linux 图标
- `icon.icns` - macOS 图标（需要从 PNG 转换）
- `icon.ico` - Windows 图标（需要从 PNG 转换）

### Q: 如何修改应用名称？

编辑根目录 `package.json` 中的 `build.productName` 字段。

### Q: 数据如何迁移？

复制上述数据存储位置的整个目录到新系统即可。

### Q: 如何实现自动更新？

需要配置代码签名和更新服务器，详见 [electron-builder 文档](https://www.electron.build/configuration/publish)。

## 技术栈

- **Electron** ^33.4.2 - 桌面应用框架
- **electron-builder** ^25.1.8 - 应用打包工具
- **TypeScript** ^5.9.3 - 类型安全
- **React** ^19.2.0 - 前端框架
- **Express** ^5.2.1 - 后端框架
- **better-sqlite3** ^12.5.0 - 本地数据库
