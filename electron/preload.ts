import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 获取应用版本
    getVersion: () => process.versions.electron,

    // 获取平台信息
    getPlatform: () => process.platform,

    // 未来可以添加更多桌面功能
    // 例如：文件对话框、通知等
});
