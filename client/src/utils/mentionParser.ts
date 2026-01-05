import type { Role } from '../types/role';

interface MentionResult {
  mentions: Role[];
  lastMention: Role | null;
  textWithoutMentions: string;
}

/**
 * 解析消息中的 @提及
 * @param text 用户输入的文本
 * @param roles 可用的角色列表
 * @returns 解析结果
 */
export function parseMentions(text: string, roles: Role[]): MentionResult {
  // 匹配 @角色名
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];

  // 查找匹配的角色
  const mentions: Role[] = [];
  for (const match of matches) {
    const roleName = match[1];
    const role = roles.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (role) {
      mentions.push(role);
    }
  }

  // 获取最后一个提及的角色
  const lastMention = mentions.length > 0 ? mentions[mentions.length - 1] : null;

  // 移除 @提及，返回纯文本
  const textWithoutMentions = text.replace(mentionRegex, '').trim();

  return {
    mentions,
    lastMention,
    textWithoutMentions,
  };
}

/**
 * 检查光标位置是否在 @ 符号后
 * @param text 输入文本
 * @param cursorPosition 光标位置
 * @returns 是否应该显示角色选择器
 */
export function shouldShowMentionSuggestions(
  text: string,
  cursorPosition: number
): { show: boolean; searchText: string } {
  // 获取光标前的文本
  const textBeforeCursor = text.substring(0, cursorPosition);

  // 查找最后一个 @ 符号
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) {
    return { show: false, searchText: '' };
  }

  // 获取 @ 后的文本
  const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

  // 如果 @ 后有空格，不显示建议
  if (textAfterAt.includes(' ')) {
    return { show: false, searchText: '' };
  }

  return {
    show: true,
    searchText: textAfterAt,
  };
}
