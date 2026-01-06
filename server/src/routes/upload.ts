import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import db from '../database';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { JWT_SECRET } from '../config/constants';
import jwt from 'jsonwebtoken';

const router = Router();

// 获取上传目录
function getUploadsDir(): string {
  // Electron 环境下使用用户数据路径
  if (process.env.USER_DATA_PATH) {
    return path.join(process.env.USER_DATA_PATH, 'uploads');
  }
  // 默认使用相对路径
  return path.join(__dirname, '../../uploads');
}

const uploadsDir = getUploadsDir();

// 确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器 - 只允许特定类型
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    // 文本文件
    'text/plain',
    'text/markdown',
    'application/pdf',
    // 图片
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
  },
});

// 提取文本内容
async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      // 读取纯文本文件
      return fs.readFileSync(filePath, 'utf-8');
    } else if (mimeType === 'application/pdf') {
      // 解析 PDF
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (mimeType.startsWith('image/')) {
      // 图片暂时返回 null，后续可以集成 OCR
      return null;
    }
    return null;
  } catch (error) {
    console.error('Extract text error:', error);
    return null;
  }
}

// 上传文件（需要认证）
router.post('/', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 提取文本内容
    const extractedText = await extractText(file.path, file.mimetype);

    // 保存文件信息到数据库（暂时没有 message_id，等发送消息时关联）
    const attachmentId = randomUUID();
    const fileInfo = {
      id: attachmentId,
      file_name: file.originalname,
      file_type: file.mimetype.startsWith('image/') ? 'image' : 'document',
      file_size: file.size,
      file_path: file.path,
      mime_type: file.mimetype,
      extracted_text: extractedText,
    };

    // 返回文件信息（暂时不保存到数据库，等发送消息时一起保存）
    res.json({
      id: attachmentId,
      file_name: file.originalname,
      file_type: fileInfo.file_type,
      file_size: file.size,
      mime_type: file.mimetype,
      extracted_text: extractedText,
      file_path: file.path,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '文件上传失败: ' + error.message });
  }
});

// 下载文件
router.get('/:fileId', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: '未提供认证信息' });
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      userId = decoded.userId;
    } catch (error: any) {
      return res.status(401).json({ error: '无效的认证信息' });
    }

    const { fileId } = req.params;

    const attachment = db.prepare(`
      SELECT a.*, m.conversation_id, c.user_id
      FROM attachments a
      JOIN messages m ON a.message_id = m.id
      JOIN conversations c ON m.conversation_id = c.id
      WHERE a.id = ?
    `).get(fileId) as any;

    if (!attachment) {
      return res.status(404).json({ error: '文件不存在' });
    }

    if (attachment.user_id !== userId) {
      return res.status(403).json({ error: '无权访问该文件' });
    }

    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ error: '文件已被删除' });
    }

    // 设置正确的Content-Type
    res.setHeader('Content-Type', attachment.mime_type);

    // 发送文件
    res.sendFile(path.resolve(attachment.file_path));
  } catch (error: any) {
    console.error('[Upload GET] 错误:', error);
    res.status(500).json({ error: '文件下载失败: ' + error.message });
  }
});

export default router;
