import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { AppHeader as StudentHeader } from './StudentDashboard';
import { TutorTopNav } from './TutorDashboard';
import '../styles/ChatPage.css';

const ChatPage: React.FC = () => {
    const auth = useAuth();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const toName = searchParams.get('name') || 'Usuario';
    const [role, setRole] = useState<'student' | 'tutor'>('student');

    const [messages, setMessages] = useState<{ id: string; from: 'me' | 'them'; text: string }[]>([
        { id: `${Date.now()}-${Math.random()}`, from: 'them', text: `👋 Hola, soy ${toName}. ¿Cómo estás?` },
    ]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const email = auth.user?.profile?.email || '';
        const roles = auth.user?.profile?.roles;
        const isTutor = Array.isArray(roles) && roles.includes('tutor');

        if (email.includes('@')) {
            setRole(isTutor ? 'tutor' : 'student');
        } else {
            // fallback si no se puede determinar
            setRole('student');
        }
    }, [auth.user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, from: 'me', text: input.trim() }]);
        setTimeout(() => {
            setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, from: 'them', text: 'Recibido 👍' }]);
        }, 700);
        setInput('');
    };

    return (
        <div className="chat-page-container">
            {role === 'student' ? (
                <StudentHeader currentUser={{
                    name: auth.user?.profile?.name || 'Estudiante',
                    email: auth.user?.profile?.email || 'No email',
                    role: 'student',
                    userId: auth.user?.profile?.sub || '',
                }} activeSection="none" />
            ) : (
                <header className="dashboard-header">
                    <div className="header-content">
                        <div className="logo"><h2>UpLearn Tutor</h2></div>
                        <TutorTopNav currentRole="tutor" />
                    </div>
                </header>
            )}

            <main className="chat-main">
                <div className="chat-box">
                    <div className="chat-header">
                        <h2>Chat con {toName}</h2>
                        <p className="chat-sub">Mensajes simulados (modo demo)</p>
                    </div>

                    <div className="chat-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-message ${msg.from === 'me' ? 'me' : 'them'}`}>
                                <div className="bubble">{msg.text}</div>
                            </div>
                        ))}
                        <div ref={messagesEndRef}></div>
                    </div>

                    <div className="chat-input-area">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} className="btn-send">Enviar</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ChatPage;
