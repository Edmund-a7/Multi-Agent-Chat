import { Modal, Typography } from '@arco-design/web-react';

const { Text } = Typography;

interface KeyboardShortcutsModalProps {
    visible: boolean;
    onClose: () => void;
}

const shortcuts = [
    { keys: ['⌘/Ctrl', 'N'], description: '创建新对话' },
    { keys: ['⌘/Ctrl', 'K'], description: '切换侧边栏' },
    { keys: ['Esc'], description: '关闭侧边栏/弹窗' },
    { keys: ['Enter'], description: '发送消息' },
    { keys: ['Shift', 'Enter'], description: '换行' },
    { keys: ['@'], description: '提及 AI 角色' },
    { keys: ['/'], description: '显示快捷命令' },
];

export default function KeyboardShortcutsModal({ visible, onClose }: KeyboardShortcutsModalProps) {
    return (
        <Modal
            title="键盘快捷键"
            visible={visible}
            onCancel={onClose}
            footer={null}
            style={{ maxWidth: 400 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {shortcuts.map((shortcut, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: index < shortcuts.length - 1 ? '1px solid var(--border-2)' : 'none',
                        }}
                    >
                        <Text>{shortcut.description}</Text>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {shortcut.keys.map((key, keyIndex) => (
                                <span key={keyIndex}>
                                    <kbd
                                        style={{
                                            padding: '4px 8px',
                                            background: 'var(--bg-2)',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontFamily: 'inherit',
                                            border: '1px solid var(--border-2)',
                                        }}
                                    >
                                        {key}
                                    </kbd>
                                    {keyIndex < shortcut.keys.length - 1 && (
                                        <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>+</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
