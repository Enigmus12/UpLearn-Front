import React, { useState, useEffect, useRef } from 'react';
import { ChatContact, ChatMessageData, getChatHistory } from '../../service/Api-chat';
import { ChatSocket } from '../../service/ChatSocket';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatWindowProps {
  contact: ChatContact;
  myUserId: string;
  token: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ contact, myUserId, token }) => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket] = useState(() => new ChatSocket());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatId = [myUserId, contact.id].sort().join(':');

  useEffect(() => {
    // Cargar historial
    getChatHistory(chatId, token).then(setMessages);

    // Conectar WebSocket
    socket.connect(token, (event) => {
      const msg = JSON.parse(event.data);
      // Solo procesar mensajes de este chat
      if (msg.chatId === chatId) {
        setMessages(prev => [...prev, msg]);
      }
    }, (state) => console.log(`Socket state: ${state}`));

    return () => socket.disconnect();
  }, [chatId, token, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket.sendMessage(contact.id, newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <h4>{contact.name}</h4>
      </div>
      <div className="chat-messages">
        {messages.map(msg => (
          <ChatMessageBubble key={msg.id} message={msg} isMine={msg.senderId === myUserId} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
        />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
};