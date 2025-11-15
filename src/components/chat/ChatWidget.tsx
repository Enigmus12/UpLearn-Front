import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { ChatContact, getChatContacts } from '../../service/Api-chat';
import { ChatWindow } from './ChatWindow';
import '../../styles/Chat.css'; 

export const ChatWidget: React.FC = () => {
  const auth = useAuth();
  const token = auth.user?.id_token;
  const myUserId = auth.user?.profile.sub;
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [activeChat, setActiveChat] = useState<ChatContact | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleChat = async () => {
    if (!isOpen && token) {
      setLoading(true);
      try {
        const fetchedContacts = await getChatContacts(token);
        setContacts(fetchedContacts);
      } catch (error) {
        console.error("Error al cargar contactos:", error);
      } finally {
        setLoading(false);
      }
    }
    setIsOpen(!isOpen);
  };

  const startChat = (contact: ChatContact) => {
    setActiveChat(contact);
  };

  if (!myUserId || !token) return null;

  return (
    <>
      <button className="chat-fab" onClick={toggleChat}>
        💬
      </button>
      {isOpen && (
        <div className="chat-widget-container">
          <div className="chat-sidebar">
            <h3 className="chat-header">Contactos</h3>
            {loading ? <p>Cargando...</p> : (
              <ul className="contact-list">
                {contacts.map(contact => (
                  <li key={contact.id} onClick={() => startChat(contact)}>
                    <img src={contact.avatarUrl || `https://ui-avatars.com/api/?name=${contact.name.replace(' ', '+')}&background=random`} alt={contact.name} />
                    {contact.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="chat-main">
            {activeChat ? (
              <ChatWindow contact={activeChat} myUserId={myUserId} token={token} />
            ) : (
              <div className="chat-placeholder">
                <p>Selecciona un contacto para comenzar a chatear.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};