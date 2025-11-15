import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import {
  acceptReservation,
  cancelReservation,
  getTutorReservations,
  type Reservation,
} from '../service/Api-scheduler';
import { getChatHistory } from '../service/Api-chat'; // CORRECCIÓN: Importado desde Api-chat
import { ChatSocket } from '../service/ChatSocket'; // Importar el cliente de WebSocket
import '../styles/TutorDashboard.css';
import '../styles/Chat.css'; // Asegúrate de crear este archivo
import { ENV } from '../utils/env';

// --- Interfaces y Tipos del Chat ---
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
  timestamp: string;
  delivered: boolean;
  read: boolean;
}

// --- Componentes del Chat (integrados en este archivo) ---

const ChatMessageBubble: React.FC<{ message: ChatMessageData, isMine: boolean }> = ({ message, isMine }) => {
  const bubbleClass = isMine ? 'chat-bubble mine' : 'chat-bubble theirs';
  return (
    <div className={bubbleClass}>
      <p>{message.content}</p>
      <span className="timestamp">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
};

interface ChatSidePanelProps {
  contact: ChatContact;
  myUserId: string;
  token: string;
  onClose: () => void;
}

const ChatSidePanel: React.FC<ChatSidePanelProps> = ({ contact, myUserId, token, onClose }) => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket] = useState(() => new ChatSocket());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatId = [myUserId, contact.id].sort().join(':');

  useEffect(() => {
    getChatHistory(chatId, token).then(setMessages).catch(console.error);

    socket.connect(token, (event) => {
      const msg = JSON.parse(event.data);
      if (msg.chatId === chatId) {
        setMessages(prev => [...prev, msg]);
      }
    }, (state) => console.log(`Socket state: ${state}`));

    return () => socket.disconnect();
  }, [chatId, token, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket.sendMessage(contact.id, newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="chat-side-panel">
      <div className="chat-window-header">
        <h4>{contact.name}</h4>
        <button onClick={onClose} className="close-chat-btn">×</button>
      </div>
      <div className="chat-messages">
        {messages.map(msg => (
          <ChatMessageBubble key={msg.id} message={msg} isMine={msg.senderId === myUserId} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribe un mensaje..." />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
};


// --- Funciones de Utilidad (Página principal) ---

function toISODateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
function formatDate(anyDate: string | Date): string {
    let d: Date;
    if (typeof anyDate === 'string') {
        const appendTime = anyDate.length === 10 ? 'T00:00:00' : '';
        d = new Date(anyDate + appendTime);
    } else { d = anyDate; }
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function formatTime(timeStr: string): string {
    const s = (timeStr ?? '').trim();
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5);
}
function getEffectiveStatus(res: Reservation): string {
    const now = new Date();
    const startMs = new Date(`${res.date}T${formatTime(res.start)}`).getTime();
    const endMs = new Date(`${res.date}T${formatTime(res.end)}`).getTime();
    const nowMs = now.getTime();
    const raw = (res.status || '').toUpperCase();

    if (raw === 'CANCELADO') return 'CANCELADO';
    if (raw === 'FINALIZADA') return 'FINALIZADA';
    if (raw === 'INCUMPLIDA') return 'INCUMPLIDA';
    
    if (raw === 'PENDIENTE') {
        return nowMs > endMs ? 'VENCIDA' : 'PENDIENTE';
    }
    if (raw === 'ACEPTADO') {
        if (nowMs >= startMs && nowMs <= endMs) return 'ACTIVA';
        if (nowMs > endMs) return res.attended === false ? 'INCUMPLIDA' : 'FINALIZADA';
        return 'ACEPTADO';
    }
    return raw || 'DESCONOCIDO';
}

const USERS_BASE = ENV.USERS_BASE;
const PROFILE_PATH = ENV.USERS_PROFILE_PATH;

type StudentGroup = {
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  reservations: (Reservation & { effectiveStatus: string })[];
};

// --- Componente Principal ---
const TutorClassesPage: React.FC = () => {
    const auth = useAuth();
    const token = (auth.user as any)?.id_token ?? auth.user?.access_token;
    const myUserId = auth.user?.profile.sub;

    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [showPast, setShowPast] = useState(false);
    const [profilesById, setProfilesById] = useState<Record<string, ChatContact>>({});
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<5 | 10 | 20>(5);
    
    const [activeChatContact, setActiveChatContact] = useState<ChatContact | null>(null);

    const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const from = toISODateLocal(new Date(new Date().setDate(new Date().getDate() - 30)));
            const to = toISODateLocal(new Date(new Date().setDate(new Date().getDate() + 60)));
            const data = await getTutorReservations(from, to, token);
            setReservations(data.filter(r => r.status !== 'CANCELADO'));
        } catch (e: any) { setMessage('❌ ' + (e.message || 'Error cargando clases')); } 
        finally { setLoading(false); }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const handleAccept = async (reservationId: string) => {
        if (!token) return;
        try {
            await acceptReservation(reservationId, token);
            setMessage('✅ Clase aceptada');
            await load();
        } catch (e: any) { setMessage('❌ ' + (e.message || 'Error al aceptar')); }
    };
    const handleCancel = async (reservationId: string) => {
        if (!token) return;
        try {
            await cancelReservation(reservationId, token);
            setMessage('✅ Clase cancelada');
            await load();
        } catch (e: any) { setMessage('❌ ' + (e.message || 'Error al cancelar')); }
    };

    const handleContact = (studentId: string, studentName: string, studentAvatar?: string) => {
        setActiveChatContact({
            id: studentId,
            sub: studentId,
            name: studentName,
            email: profilesById[studentId]?.email || 'N/A',
            avatarUrl: studentAvatar,
        });
    };

    // CORRECCIÓN: Función `getStatusColor` restaurada
    const getStatusColor = (status?: string | null) => ({
      'PENDIENTE': '#F59E0B',
      'ACEPTADO': '#10B981',
      'ACTIVA': '#6366F1',
      'FINALIZADA': '#0EA5E9',
      'INCUMPLIDA': '#F97316',
      'VENCIDA': '#9CA3AF',
    }[String(status || '').toUpperCase()] || '#6B7280');

    const getStatusText = (status?: string | null) => (status || '').toUpperCase() || '—';

    const reservationsFiltered = useMemo(() => {
        return reservations
            .map(r => ({ ...r, effectiveStatus: getEffectiveStatus(r) }))
            .filter(r => {
                if (filterStatus !== 'all' && r.effectiveStatus !== filterStatus) return false;
                if (!showPast) {
                    const endTime = new Date(`${r.date}T${formatTime(r.end)}`).getTime();
                    return endTime >= new Date().getTime();
                }
                return true;
            })
            .sort((a, b) => new Date(`${a.date}T${a.start}`).getTime() - new Date(`${b.date}T${b.start}`).getTime());
    }, [reservations, filterStatus, showPast]);

    useEffect(() => {
        const ids = Array.from(new Set(reservations.map(r => r.studentId))).filter(id => id && !profilesById[id]);
        if (ids.length === 0 || !token) return;
        (async () => {
            const results = await Promise.allSettled(ids.map(async (id) => {
                const resp = await fetch(`${USERS_BASE}${PROFILE_PATH}?id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return { id, prof: await resp.json() };
            }));
            const nextProfiles: Record<string, ChatContact> = {};
            results.forEach(res => {
                if (res.status === 'fulfilled') {
                    nextProfiles[res.value.id] = { id: res.value.id, ...res.value.prof, name: res.value.prof.name || 'Estudiante' };
                }
            });
            if (Object.keys(nextProfiles).length > 0) setProfilesById(prev => ({ ...prev, ...nextProfiles }));
        })();
    }, [reservations, profilesById, token]);

    const groupsAll: StudentGroup[] = useMemo(() => {
        const acc: Record<string, StudentGroup> = {};
        for (const res of reservationsFiltered) {
            const sid = res.studentId;
            const profile = profilesById[sid];
            const name = res.studentName || profile?.name || 'Estudiante';
            const avatar = res.studentAvatar || profile?.avatarUrl;
            if (!acc[sid]) acc[sid] = { studentId: sid, studentName: name, studentAvatar: avatar, reservations: [] };
            acc[sid].reservations.push(res);
        }
        return Object.values(acc).sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
    }, [reservationsFiltered, profilesById]);

    const groupsFiltered = useMemo(() => {
        if (!query.trim()) return groupsAll;
        const q = norm(query);
        return groupsAll.filter(g => norm(g.studentName).includes(q));
    }, [groupsAll, query]);

    const totalPages = Math.max(1, Math.ceil(groupsFiltered.length / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const groupsPage = groupsFiltered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
    useEffect(() => { setPage(1); }, [filterStatus, query, pageSize, showPast]);

    const badge = (msg: string) => { /* ... */ };

    return (
        <div className="page-with-chat-container">
            <div className={`main-content ${activeChatContact ? 'chat-open' : ''}`}>
                <h1>Solicitudes 📬</h1>
                {/* ... (resto del contenido: filtros, paginación, lista de grupos) ... */}
                {groupsPage.map(group => (
                    <div key={group.studentId} className="student-group-card">
                        <div className="student-group-header">
                            {group.studentAvatar ? <img src={group.studentAvatar} alt={group.studentName} /> : <div className="avatar-placeholder">{(group.studentName || 'E').charAt(0)}</div>}
                            <h3>{group.studentName}</h3>
                        </div>
                        <div className="reservations-container">
                            {group.reservations.map((res: any) => {
                                const effectiveStatus = res.effectiveStatus;
                                const canAccept = effectiveStatus === 'PENDIENTE';
                                const canCancel = effectiveStatus === 'PENDIENTE' || effectiveStatus === 'ACEPTADO';
                                const canContact = effectiveStatus === 'ACEPTADO' || effectiveStatus === 'ACTIVA';
                                return (
                                    <div key={res.id} className="reservation-row">
                                        <div className="reservation-info">
                                            <p className="reservation-datetime">📅 {formatDate(res.date)} • 🕐 {formatTime(res.start)} - {formatTime(res.end)}</p>
                                            <p className="reservation-id">ID: {String(res.id).slice(0, 8)}...</p>
                                        </div>
                                        <div className="reservation-meta">
                                            <span className="status-badge" style={{ backgroundColor: `${getStatusColor(effectiveStatus)}20`, color: getStatusColor(effectiveStatus) }}>
                                                {getStatusText(effectiveStatus)}
                                            </span>
                                        </div>
                                        <div className="reservation-actions">
                                            <button className="btn-action btn-accept" onClick={() => handleAccept(res.id)} disabled={!canAccept}>✓ Aceptar</button>
                                            <button className="btn-action btn-cancel" onClick={() => handleCancel(res.id)} disabled={!canCancel}>✗ Cancelar</button>
                                            <button className="btn-action btn-contact" onClick={() => handleContact(group.studentId, group.studentName, group.studentAvatar)} disabled={!canContact}>● Contactar</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {activeChatContact && myUserId && token && (
                <ChatSidePanel 
                    contact={activeChatContact} 
                    myUserId={myUserId}
                    token={token}
                    onClose={() => setActiveChatContact(null)}
                />
            )}
        </div>
    );
};
export default TutorClassesPage;
