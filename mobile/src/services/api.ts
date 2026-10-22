// Mobile Shared API Client
// Handles Android emulator (10.0.2.2) and real device network routing

const API_BASE = 'http://10.0.2.2:8000';

class MobileApiClient {
  private token: string | null = null;
  private activeOrgId: string | null = null;

  setToken(t: string | null) {
    this.token = t;
  }

  setActiveOrgId(id: string | null) {
    this.activeOrgId = id;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }
    if (this.activeOrgId) {
      headers['X-Organization-Id'] = this.activeOrgId;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.getHeaders(), ...(options.headers as any) },
    });

    if (!response.ok) {
      let errText = '';
      try {
        const errObj = await response.json();
        errText = errObj.detail || errObj.message || JSON.stringify(errObj);
      } catch {
        errText = response.statusText;
      }
      throw new Error(errText || 'Network request failed.');
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const mobileApi = new MobileApiClient();
