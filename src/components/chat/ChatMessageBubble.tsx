import React from 'react';
import { ChatMessageData } from '../../service/Api-chat';

interface ChatMessageBubbleProps {
  message: ChatMessageData;
  isMine: boolean;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message, isMine }) => {
  const bubbleClass = isMine ? 'chat-bubble mine' : 'chat-bubble theirs';
  return (
    <div className={bubbleClass}>
      <p>{message.content}</p>
      <span className="timestamp">{new Date(message.timestamp).toLocaleTimeString()}</span>
    </div>
  );
};