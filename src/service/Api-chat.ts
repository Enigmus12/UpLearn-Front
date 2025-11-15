import { ENV } from '../utils/env';

const CHAT_BASE = ENV.CHAT_API_BASE; // http://localhost:8091

// Definir los tipos para mayor claridad
export interface ChatContact {
  id: string;
  sub: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface ChatMessageData {
  id: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string; // ISO string
  delivered: boolean;
  read: boolean;
}

/**
 * Obtiene la lista de contactos con los que el usuario puede chatear.
 */
export async function getChatContacts(token: string): Promise<ChatContact[]> {
  const url = `${CHAT_BASE}/api/chat/contacts`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error('No se pudo obtener la lista de contactos');
  }
  return response.json();
}

/**
 * Obtiene el historial de mensajes para un chatId específico.
 */
export async function getChatHistory(chatId: string, token: string): Promise<ChatMessageData[]> {
  const url = `${CHAT_BASE}/api/chat/history/${chatId}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error('No se pudo cargar el historial del chat');
  }
  return response.json();
}