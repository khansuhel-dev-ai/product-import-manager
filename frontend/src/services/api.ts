const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
    return response.json();
  }

  async postFile<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  }

  async downloadFile(path: string, filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const data = await response.json();
      return {
        message: data.message || `Request failed with status ${response.status}`,
        errors: data.errors,
      };
    } catch {
      return { message: `Request failed with status ${response.status}` };
    }
  }
}

export const api = new ApiClient(API_BASE_URL);

