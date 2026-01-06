import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverPort: number = 3000;
let isQuitting = false;

// 开发模式检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, '../../resources/icon.png'),
        titleBarStyle: 'default',
        show: false, // 先不显示，等加载完成后再显示
    });

    // 加载应用
    if (isDev) {
        // 开发模式：加载 Vite 开发服务器
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // 生产模式：加载构建后的文件
        mainWindow.loadURL(`http://localhost:${serverPort}`);
    }

    // 窗口加载完成后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // 打开外部链接使用系统浏览器
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // 窗口关闭时最小化到托盘（而不是退出）
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, '../../resources/icon.png');
    let trayIcon = nativeImage.createFromPath(iconPath);

    // macOS 需要调整托盘图标大小
    if (process.platform === 'darwin') {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            click: () => {
                mainWindow?.show();
            },
        },
        {
            label: '隐藏窗口',
            click: () => {
                mainWindow?.hide();
            },
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);

    tray.setToolTip('Multi-Agent Chat');
    tray.setContextMenu(contextMenu);

    // 点击托盘图标显示窗口
    tray.on('click', () => {
        mainWindow?.show();
    });
}

// 应用准备就绪
app.whenReady().then(async () => {
    // 启动后端服务器
    try {
        serverPort = await startServer();
        console.log(`后端服务器启动在端口: ${serverPort}`);
    } catch (error) {
        console.error('启动服务器失败:', error);
        app.quit();
        return;
    }

    // 创建窗口和托盘
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            mainWindow?.show();
        }
    });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
    // macOS 应用通常保持活动状态
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 应用退出前清理
app.on('before-quit', () => {
    isQuitting = true;
    stopServer();
});

app.on('will-quit', () => {
    stopServer();
});
