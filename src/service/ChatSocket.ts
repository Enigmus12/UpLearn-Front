import { ENV } from '../utils/env';

const CHAT_WS_BASE = ENV.CHAT_API_BASE.replace(/^http/, 'ws');

type WebSocketEventCallback = (event: MessageEvent) => void;

/**
 * Cliente para manejar la conexión WebSocket del chat.
 */
export class ChatSocket {
  private ws: WebSocket | null = null;
  private onMessageCallback: WebSocketEventCallback | null = null;
  private onStateChangeCallback: ((state: 'connecting' | 'open' | 'closed' | 'error') => void) | null = null;

  connect(token: string, onMessage: WebSocketEventCallback, onStateChange: (state: 'connecting' | 'open' | 'closed' | 'error') => void) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket ya está conectado.');
      return;
    }

    this.onMessageCallback = onMessage;
    this.onStateChangeCallback = onStateChange;
    this.onStateChangeCallback('connecting');

    // --- INICIO DE LA CORRECCIÓN DEFINITIVA ---
    // Tu backend espera el token como parte de la ruta (path), no como un parámetro de consulta (query).
    // Construimos la URL en el formato: ws://host/chat/EL_TOKEN
    const encodedToken = encodeURIComponent(token);
    const url = `${CHAT_WS_BASE}/chat/${encodedToken}`;
    // --- FIN DE LA CORRECCIÓN DEFINITIVA ---

    console.log(`Intentando conectar a WebSocket en: ${url}`); // Log para depuración
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket conectado.');
      this.onStateChangeCallback?.('open');
    };

    this.ws.onmessage = (event) => {
      this.onMessageCallback?.(event);
    };

    this.ws.onerror = (error) => {
      console.error('Error en WebSocket:', error);
      this.onStateChangeCallback?.('error');
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket desconectado: Código=${event.code}, Razón=${event.reason}`);
      this.ws = null;
      this.onStateChangeCallback?.('closed');
    };
  }

  sendMessage(recipientId: string, content: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ recipientId, content });
      this.ws.send(message);
    } else {
      console.error('No se puede enviar el mensaje. WebSocket no está conectado.');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}