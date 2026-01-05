import axios from 'axios';
import db from '../database';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
}

interface AIConfig {
  base_url: string;
  api_key: string;
  model: string;
  max_context_messages: number;
}

export class AIService {
  // 获取用户的 AI 配置
  static getConfig(userId: string): AIConfig | null {
    const config = db.prepare(`
      SELECT * FROM ai_config WHERE user_id = ?
    `).get(userId) as any;

    if (!config) {
      return null;
    }

    return {
      base_url: config.base_url,
      api_key: config.api_key,
      model: config.model,
      max_context_messages: config.max_context_messages || 10,
    };
  }

  // 保存或更新用户的 AI 配置
  static saveConfig(userId: string, config: Omit<AIConfig, 'max_context_messages'> & { max_context_messages?: number }): void {
    const existing = this.getConfig(userId);

    if (existing) {
      // 更新
      db.prepare(`
        UPDATE ai_config
        SET base_url = ?, api_key = ?, model = ?, max_context_messages = ?
        WHERE user_id = ?
      `).run(
        config.base_url,
        config.api_key,
        config.model,
        config.max_context_messages || 10,
        userId
      );
    } else {
      // 创建
      const { randomUUID } = require('crypto');
      db.prepare(`
        INSERT INTO ai_config (id, user_id, base_url, api_key, model, max_context_messages)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        userId,
        config.base_url,
        config.api_key,
        config.model,
        config.max_context_messages || 10
      );
    }
  }

  // 调用 OpenAI 兼容的 API（非流式）
  static async chat(
    config: AIConfig,
    systemPrompt: string,
    messages: AIMessage[]
  ): Promise<string> {
    try {
      const apiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      const response = await axios.post(
        `${config.base_url}/chat/completions`,
        {
          model: config.model,
          messages: apiMessages,
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('AI API Error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('API Key 无效，请检查设置');
      } else if (error.response?.status === 429) {
        throw new Error('API 调用频率超限，请稍后再试');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('AI 请求超时，请重试');
      } else {
        throw new Error(error.response?.data?.error?.message || 'AI 调用失败');
      }
    }
  }

  // 调用图片生成 API（使用 /images/generations 端点）
  static async generateImage(
    config: AIConfig,
    prompt: string,
    model: string = 'dall-e-3',
    size: string = '1024x1024'
  ): Promise<string> {
    try {

      const response = await axios.post(
        `${config.base_url}/images/generations`,
        {
          model: model,
          prompt: prompt,
          n: 1,
          size: size,
          response_format: 'b64_json',  // 请求 Base64 格式
        },
        {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000,  // 5 分钟超时
        }
      );

      // 提取 Base64 图片数据
      const imageData = response.data.data?.[0]?.b64_json || response.data.data?.[0]?.url;

      if (!imageData) {
        throw new Error('API 未返回图片数据');
      }

      // 如果是 URL，直接返回 Markdown 格式
      if (imageData.startsWith('http')) {
        return `![Generated Image](${imageData})`;
      }

      // 如果是 Base64，保存为文件
      const imgBuffer = Buffer.from(imageData, 'base64');
      let ext = 'png';
      let mime = 'image/png';
      if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
      else if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) { ext = 'png'; mime = 'image/png'; }

      const filename = `${randomUUID()}.${ext}`;
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, imgBuffer);

      const fileInfo = { filename, mimetype: mime, size: imgBuffer.length, path: filepath };
      return `JSON_IMAGE:${JSON.stringify(fileInfo)}`;

    } catch (error: any) {
      console.error('[AIService] 图片生成失败:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('API Key 无效，请检查设置');
      } else if (error.response?.status === 429) {
        throw new Error('API 调用频率超限，请稍后再试');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('AI 请求超时，请重试');
      } else {
        throw new Error(error.response?.data?.error?.message || '图片生成失败');
      }
    }
  }

  // 使用 Gemini 原生格式生成图片（/v1beta/models/{model}:generateContent）
  static async generateImageGemini(
    config: AIConfig,
    prompt: string,
    model: string = 'gemini-2.0-flash-exp-image-generation'
  ): Promise<string> {
    try {
      const baseUrl = config.base_url.replace(/\/v1\/?$/, '');
      const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent`;

      const response = await axios.post(
        endpoint,
        {
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000,
        }
      );

      // 提取图片数据和思考过程
      const parts = response.data.candidates?.[0]?.content?.parts || [];
      let imageData: string | null = null;
      let textContent = '';
      let reasoningContent = '';

      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
        }
        if (part.text) {
          // 检查是否是思考内容 (Gemini 使用 thought 标记)
          if (part.thought === true) {
            reasoningContent += part.text;
          } else {
            textContent += part.text;
          }
        }
      }

      if (!imageData) {
        // 如果没有图片，返回文本内容（可能包含思考过程）
        let result = '';
        if (reasoningContent) {
          result += `[REASONING]${reasoningContent}[/REASONING]`;
        }
        if (textContent) {
          result += textContent;
        }
        if (result) {
          return result;
        }
        throw new Error('Gemini 未返回图片数据');
      }

      // 保存图片
      const imgBuffer = Buffer.from(imageData, 'base64');
      let ext = 'png';
      let mime = 'image/png';
      if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
      else if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) { ext = 'png'; mime = 'image/png'; }

      const filename = `${randomUUID()}.${ext}`;
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, imgBuffer);

      const fileInfo = { filename, mimetype: mime, size: imgBuffer.length, path: filepath };

      // 返回结果，包含思考过程
      let result = '';
      if (reasoningContent) {
        result += `[REASONING]${reasoningContent}[/REASONING]`;
      }
      result += `JSON_IMAGE:${JSON.stringify(fileInfo)}`;
      return result;

    } catch (error: any) {
      console.error('[AIService] Gemini 图片生成失败:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('API Key 无效，请检查设置');
      } else if (error.response?.status === 429) {
        throw new Error('API 调用频率超限，请稍后再试');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('AI 请求超时，请重试');
      } else {
        throw new Error(error.response?.data?.error?.message || 'Gemini 图片生成失败');
      }
    }
  }

  // 调用 OpenAI 兼容的 API（流式）
  static async chatStream(
    config: AIConfig,
    systemPrompt: string,
    messages: AIMessage[],
    onChunk: (chunk: string) => void
  ): Promise<string> {
    try {
      const apiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      const response = await axios.post(
        `${config.base_url}/chat/completions`,
        {
          model: config.model,
          messages: apiMessages,
          stream: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000,
          responseType: 'stream',
        }
      );

      const contentType = response.headers['content-type'] || '';
      const isImage = contentType.startsWith('image/') || contentType === 'application/octet-stream';

      if (isImage) {
        const filename = `${randomUUID()}.${contentType.split('/')[1] || 'png'}`;
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filepath = path.join(uploadsDir, filename);
        const writer = fs.createWriteStream(filepath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            const fileInfo = {
              filename,
              mimetype: contentType || 'image/png',
              size: writer.bytesWritten,
              path: filepath
            };
            const content = `JSON_IMAGE:${JSON.stringify(fileInfo)}`;
            resolve(content);
          });
          writer.on('error', reject);
        });
      }

      let fullContent = '';
      let reasoningContent = '';  // 存储思考过程
      let chunkCount = 0;
      let isSSE: boolean | null = null;
      let rawBuffer: Buffer[] = [];

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          chunkCount++;

          if (isSSE === null) {
            // 尝试检测是否为 SSE 格式
            const startStr = chunk.toString('utf8').trim();
            if (startStr.startsWith('data:') || startStr.startsWith('event:') || startStr.startsWith(':')) {
              isSSE = true;
            } else {
              isSSE = false;
            }
          }

          // 无论 SSE 还是非 SSE，都累积原始数据以便回退处理
          rawBuffer.push(chunk);

          if (isSSE) {
            const chunkStr = chunk.toString();
            const lines = chunkStr.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.includes('[DONE]')) continue;
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6);
                  const data = JSON.parse(jsonStr);

                  // 提取思考过程 (reasoning_content)
                  const reasoning = data.choices?.[0]?.delta?.reasoning_content;
                  if (reasoning) {
                    reasoningContent += reasoning;
                    // 发送思考内容（带特殊标记）
                    onChunk(`[REASONING]${reasoning}[/REASONING]`);
                  }

                  // 尝试多种格式提取实际内容
                  let content = data.choices?.[0]?.delta?.content  // OpenAI 流式格式
                    || data.choices?.[0]?.message?.content  // OpenAI 非流式格式
                    || data.content  // 简单格式
                    || data.response  // 一些 API 的格式
                    || data.text;  // 另一些 API 的格式

                  // 检查是否有嵌入的 Base64 图片 (多种格式)
                  const imageData = data.image
                    || data.b64_json
                    || data.data?.[0]?.b64_json
                    || data.choices?.[0]?.delta?.inline_data?.data  // Gemini 流式格式
                    || data.choices?.[0]?.message?.content?.[0]?.inline_data?.data  // Gemini 完整格式
                    || data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data  // Gemini 原生格式
                    || data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;  // Gemini 多部分

                  if (imageData && typeof imageData === 'string' && imageData.length > 100) {
                    try {
                      const imgBuffer = Buffer.from(imageData, 'base64');
                      let ext = 'png';
                      let mime = 'image/png';
                      if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
                      else if (imgBuffer[0] === 0x47 && imgBuffer[1] === 0x49) { ext = 'gif'; mime = 'image/gif'; }
                      else if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) { ext = 'png'; mime = 'image/png'; }

                      const filename = `${randomUUID()}.${ext}`;
                      const uploadsDir = path.join(__dirname, '../../uploads');
                      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                      const filepath = path.join(uploadsDir, filename);
                      fs.writeFileSync(filepath, imgBuffer);

                      const fileInfo = { filename, mimetype: mime, size: imgBuffer.length, path: filepath };
                      fullContent = `JSON_IMAGE:${JSON.stringify(fileInfo)}`;
                    } catch (imgError) {
                      console.error('[AIService] Base64 图片处理失败:', imgError);
                    }
                  }
                  // 检查是否有图片 URL
                  else if (data.url || data.data?.[0]?.url) {
                    const imageUrl = data.url || data.data?.[0]?.url;
                    content = `![Generated Image](${imageUrl})`;
                  }

                  if (content && content.trim()) {
                    fullContent += content;
                    onChunk(content);
                  }
                } catch (e) {
                  // JSON 解析失败，忽略（会在流结束时用原始数据回退处理）
                }
              }
            }
          }
        });

        response.data.on('end', () => {
          // 如果 SSE 解析成功且有内容，直接返回
          if (fullContent.length > 0) {
            resolve(fullContent);
            return;
          }

          const finalBuffer = Buffer.concat(rawBuffer);
          const finalStr = finalBuffer.toString('utf8');

          // 尝试从 SSE 格式的原始数据中提取图片
          // 首先尝试用正则表达式提取 Base64 数据
          // Google Gemini 格式: "data":"iVBORw0KGgo..."
          // OpenAI 格式: "b64_json":"iVBORw0KGgo..."
          const base64Match = finalStr.match(/"(?:data|b64_json|image)"\s*:\s*"([A-Za-z0-9+/=]{100,})"/);
          if (base64Match && base64Match[1]) {
            try {
              const imgBuffer = Buffer.from(base64Match[1], 'base64');
              let ext = 'png';
              let mime = 'image/png';
              if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
              else if (imgBuffer[0] === 0x47 && imgBuffer[1] === 0x49) { ext = 'gif'; mime = 'image/gif'; }
              else if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) { ext = 'png'; mime = 'image/png'; }

              if (imgBuffer.length > 1000) {
                const filename = `${randomUUID()}.${ext}`;
                const uploadsDir = path.join(__dirname, '../../uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                const filepath = path.join(uploadsDir, filename);
                fs.writeFileSync(filepath, imgBuffer);

                const fileInfo = { filename, mimetype: mime, size: imgBuffer.length, path: filepath };
                resolve(`JSON_IMAGE:${JSON.stringify(fileInfo)}`);
                return;
              }
            } catch (e) {
              console.error('[AIService] Base64 提取失败:', e);
            }
          }

          // 1. 尝试纯 Base64 格式（整个字符串是 Base64）
          const cleanStr = finalStr.replace(/[\s\n\r]/g, '').replace(/^data:[^,]+,/, '');
          if (cleanStr.length > 100 && /^[A-Za-z0-9+/=]+$/.test(cleanStr)) {
            try {
              const imgBuffer = Buffer.from(cleanStr, 'base64');
              let ext = 'png';
              let mime = 'image/png';
              if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
              else if (imgBuffer[0] === 0x47 && imgBuffer[1] === 0x49) { ext = 'gif'; mime = 'image/gif'; }
              else if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) { ext = 'png'; mime = 'image/png'; }

              if (imgBuffer.length > 1000) {
                const filename = `${randomUUID()}.${ext}`;
                const uploadsDir = path.join(__dirname, '../../uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                const filepath = path.join(uploadsDir, filename);
                fs.writeFileSync(filepath, imgBuffer);

                const fileInfo = { filename, mimetype: mime, size: imgBuffer.length, path: filepath };
                resolve(`JSON_IMAGE:${JSON.stringify(fileInfo)}`);
                return;
              }
            } catch (e) {
              console.error('[AIService] 纯 Base64 解码失败:', e);
            }
          }

          // 2. 尝试解析为 JSON (非流式响应)
          try {
            const json = JSON.parse(finalStr);
            // 尝试多种结构提取图片
            const imgData = json.data?.[0]?.b64_json
              || json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
              || json.image;
            if (imgData) {
              const imgBuffer = Buffer.from(imgData, 'base64');
              let ext = 'png';
              let mime = 'image/png';
              if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
              else if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) { ext = 'png'; mime = 'image/png'; }

              const filename = `${randomUUID()}.${ext}`;
              const uploadsDir = path.join(__dirname, '../../uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
              const filepath = path.join(uploadsDir, filename);
              fs.writeFileSync(filepath, imgBuffer);

              const fileInfo = { filename, mimetype: mime, size: imgBuffer.length, path: filepath };
              resolve(`JSON_IMAGE:${JSON.stringify(fileInfo)}`);
              return;
            }

            // 常规文本内容
            if (json.choices?.[0]?.message?.content) {
              const content = json.choices[0].message.content;
              onChunk(content);
              resolve(content);
              return;
            }
          } catch (e) { }

          // 3. 原样返回
          onChunk(finalStr);
          resolve(finalStr);
        });

        response.data.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error: any) {
      console.error('[AIService] 请求失败:', error.message);
      console.error('[AIService] 错误详情:', error.response?.data);
      console.error('[AIService] 错误状态码:', error.response?.status);

      if (error.response?.status === 401) {
        throw new Error('API Key 无效，请检查设置');
      } else if (error.response?.status === 429) {
        throw new Error('API 调用频率超限，请稍后再试');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('AI 请求超时，请重试');
      } else {
        throw new Error(error.response?.data?.error?.message || 'AI 调用失败');
      }
    }
  }
}

