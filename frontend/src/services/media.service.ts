import { http } from './http';

export interface UploadedMediaItem {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export type MediaUploadKind = 'listing' | 'verification';

export const mediaService = {
  async uploadImages(files: File[], kind: MediaUploadKind = 'listing'): Promise<UploadedMediaItem[]> {
    const formData = new FormData();
    formData.append('kind', kind);
    for (const file of files) {
      formData.append('images', file);
    }

    const response = await http.post<{ success: true; data: { items: UploadedMediaItem[] } }>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data.items;
  },
};
