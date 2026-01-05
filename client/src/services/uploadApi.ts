import api from './api';

export interface Attachment {
  id: string;
  file_name: string;
  file_type: 'image' | 'document';
  file_size: number;
  mime_type: string;
  extracted_text?: string | null;
  file_path?: string;
  created_at?: number;
}

export const uploadApi = {
  // 上传文件
  uploadFile: async (file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<Attachment>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // 下载文件
  downloadFile: (fileId: string): string => {
    const token = localStorage.getItem('token');
    const baseURL = api.defaults.baseURL || 'http://localhost:3000/api';
    return `${baseURL}/upload/${fileId}?token=${token}`;
  },
};
