type MessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: any = null;
  private isConnecting = false;

  connect() {
    const token = localStorage.getItem('lc_auth_token');
    if (!token || this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';
    const wsUrl = `${wsBase}/ws/connect/?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connection_status', { connected: true });

        // Join active org presence
        const activeOrg = localStorage.getItem('lc_active_org_id');
        if (activeOrg) {
          this.send('join_presence', { organization_id: activeOrg });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type;
          if (type) {
            this.emit(type, data);
          }
        } catch (e) {
          console.error('Failed to parse websocket message', e);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.ws = null;
        this.emit('connection_status', { connected: false, code: event.code });

        // Don't reconnect on auth failure
        if (event.code !== 4001 && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
          this.reconnectAttempts++;
          this.reconnectTimeout = setTimeout(() => this.connect(), delay);
        }
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        console.warn('WebSocket connection error', err);
      };
    } catch (err) {
      this.isConnecting = false;
      console.warn('WebSocket init exception', err);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  send(action: string, payload: Record<string, any> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(type: string, data: any) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }
}

export const wsClient = new WebSocketClient();
