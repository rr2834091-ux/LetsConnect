// Mobile Real-Time WebSocket Transport
const WS_BASE = 'ws://10.0.2.2:8000';

export class MobileWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(d: any) => void>> = new Map();

  connect(token: string) {
    if (this.ws) return;
    try {
      this.ws = new WebSocket(`${WS_BASE}/ws/connect/?token=${token}`);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type && this.listeners.has(data.type)) {
            this.listeners.get(data.type)!.forEach((h) => h(data));
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.ws = null;
      };
    } catch (e) {
      console.warn('Mobile WS error', e);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(action: string, payload: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  on(type: string, handler: (d: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }
}

export const mobileWs = new MobileWebSocketClient();
