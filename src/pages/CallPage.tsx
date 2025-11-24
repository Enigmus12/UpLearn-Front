import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useParams, useNavigate } from 'react-router-dom';
import CallControls from '../components/CallControls';
import CallChatButton from '../components/CallChatButton';
import { getIceServers } from '../service/callApi';
import '../styles/CallPage.css';

// --- Tipos y Utilidades ---
type Envelope = {
  type: string;
  sessionId: string;
  reservationId?: string;
  from?: string;
  to?: string;
  payload?: any;
  ts: number;
  traceId: string;
};

function ulid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Helper para determinar la clase CSS del estado
const getStatusClass = (state: string) => {
  const s = state.toLowerCase();
  if (s === 'connected' || s === 'completed' || s === 'stable') return 'connected';
  if (s.includes('fail') || s.includes('close') || s.includes('error')) return 'failed';
  return ''; // Default es amarillo/loading
};

export default function CallPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const userId = auth.user?.profile?.sub;
  const token = (auth.user as any)?.id_token ?? auth.user?.access_token;

  const [reservationId] = useState<string>(() => {
    if (!sessionId) return '';
    return sessionStorage.getItem('call:reservation:' + sessionId) || '';
  });

  // --- Refs de RTC y WS ---
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // --- Elementos de Video ---
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  // --- Streams ---
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // --- Estado UI ---
  const [connState, setConnState] = useState<string>('Inicializando...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // --- Colas y Flags Internos ---
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  const wsOpenRef = useRef(false);
  const joinAckRef = useRef(false);
  const sentOfferRef = useRef(false);
  const gotRemoteDescRef = useRef(false);

  // --- Debug State ---
  const [debug, setDebug] = useState({
    wsState: 'N/A',
    pcSignaling: 'N/A',
    pcIce: 'N/A',
    hasLocalMedia: 'no',
    lastMsg: '' as string,
  });

  const updateDebug = (patch: Partial<typeof debug>) =>
    setDebug((d) => ({ ...d, ...patch }));

  const safeLog = (...args: any[]) => console.log('[CALL]', ...args);
  const safeWarn = (...args: any[]) => console.warn('[CALL]', ...args);
  const safeErr = (...args: any[]) => console.error('[CALL]', ...args);

  // --- WebSocket Helper ---
  const send = (wsInstance: WebSocket | null, env: Partial<Envelope>) => {
    if (!wsInstance) { safeWarn('send(): ws null'); return; }
    if (wsInstance.readyState !== WebSocket.OPEN) {
      safeWarn('send(): ws not OPEN, state=', wsInstance.readyState);
      return;
    }
    const payload = {
      ...env,
      sessionId,
      reservationId,
      from: userId,
      ts: Date.now(),
      traceId: ulid(),
    };
    safeLog('WS SEND =>', payload);
    wsInstance.send(JSON.stringify(payload));
  };

  // --- Lógica de Negociación (Offer) ---
  const maybeStartOffer = async () => {
    const pc = pcRef.current;
    if (!pc || sentOfferRef.current) {
      if (!pc) safeWarn('maybeStartOffer(): no pc');
      return;
    }
    const hasMedia = Boolean(localVideo.current?.srcObject as MediaStream | null);
    if (!wsOpenRef.current || !joinAckRef.current || !hasMedia) {
      safeLog('maybeStartOffer(): esperando condiciones', {
        wsOpen: wsOpenRef.current, joinAck: joinAckRef.current, hasMedia
      });
      return;
    }
    try {
      sentOfferRef.current = true;
      safeLog('Creando y enviando OFFER…');
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      send(wsRef.current, { type: 'OFFER', payload: offer });
    } catch (e) {
      sentOfferRef.current = false;
      safeErr('maybeStartOffer error', e);
    }
  };

  const startOffer = async () => {
    safeLog('Botón Conectar pulsado');
    await maybeStartOffer();
  };

  // --- Efecto Principal: Inicialización ---
  useEffect(() => {
    safeLog('MOUNT CallPage', { sessionId, reservationId, hasToken: !!token, userId });
    updateDebug({ lastMsg: 'mount', hasLocalMedia: 'no' });

    if (!sessionId || !reservationId) {
      safeWarn('Faltan datos. sessionId/reservationId', { sessionId, reservationId });
      setErrorMsg('Faltan datos de la sesión.');
      return;
    }
    if (!token) {
      if (!auth.isLoading && !auth.isAuthenticated) setErrorMsg('No autenticado');
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        setConnState('Obteniendo servidores...');
        const iceServers = await getIceServers();
        if (!isMounted) return;

        const pcLocal = new RTCPeerConnection({
          iceServers,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        });
        pcRef.current = pcLocal;

        // 1. Media Local
        setConnState('Accediendo a dispositivos...');
        safeLog('Solicitando getUserMedia…');
        const camStream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        camStreamRef.current = camStream;
        
        if (localVideo.current) localVideo.current.srcObject = camStream;
        camStream.getTracks().forEach((track: MediaStreamTrack) => pcLocal.addTrack(track, camStream));
        updateDebug({ hasLocalMedia: 'sí' });

        // 2. Eventos RTC
        pcLocal.ontrack = (ev) => {
          safeLog('ontrack: stream remoto recibido');
          if (remoteVideo.current) remoteVideo.current.srcObject = ev.streams[0];
        };
        
        pcLocal.onicecandidate = (ev) => {
          if (ev.candidate) {
            send(wsRef.current, { type: 'ICE_CANDIDATE', payload: ev.candidate });
          }
        };

        pcLocal.oniceconnectionstatechange = () => {
          setConnState(pcLocal.iceConnectionState);
          updateDebug({ pcIce: pcLocal.iceConnectionState });
        };
        
        pcLocal.onsignalingstatechange = () => {
          updateDebug({ pcSignaling: pcLocal.signalingState });
        };
        
        pcLocal.onconnectionstatechange = () => {
          setConnState(pcLocal.connectionState);
        };

        // 3. WebSocket
        const envHost = (import.meta as any)?.env?.VITE_CALLS_HOST || (window as any).__CALLS_HOST__;
        const defaultHost = `${window.location.hostname}:8093`;
        const host = envHost || defaultHost;
        const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsBase = host.startsWith('http') ? new URL(host).host : host;
        const wsUrl = `${scheme}://${wsBase}/ws/call?token=${encodeURIComponent(token)}`;

        safeLog('Abriendo WS:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        updateDebug({ wsState: 'CONNECTING', lastMsg: 'ws-connecting' });
        setConnState('Conectando al servidor...');

        ws.onopen = () => {
          wsOpenRef.current = true;
          updateDebug({ wsState: 'OPEN', lastMsg: 'ws-open' });
          send(ws, { type: 'JOIN' });
        };

        ws.onmessage = async (e) => {
          if (!isMounted) return;
          updateDebug({ lastMsg: 'ws-message' });
          const msg: Envelope = JSON.parse(e.data);

          if (msg.type === 'ERROR') {
            setErrorMsg(String(msg?.payload?.message ?? 'Error en señalización'));
            ws.close();
            return;
          }

          if (msg.type === 'JOIN_ACK') {
            joinAckRef.current = true;
            setTimeout(() => startOffer(), 300);
            await maybeStartOffer();
            return;
          }

          if (msg.from === userId) return; // Ignore echoes

          try {
            if (msg.type === 'OFFER') {
              // Manejo de Glare simple
              if (pcLocal.signalingState !== 'stable') {
                await Promise.all([
                  pcLocal.setLocalDescription({ type: 'rollback' } as any),
                  pcLocal.setRemoteDescription(msg.payload as RTCSessionDescriptionInit),
                ]);
              } else {
                await pcLocal.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
              }
              gotRemoteDescRef.current = true;
              
              // Procesar cola ICE
              while (iceCandidatesQueue.current.length > 0) {
                await pcLocal.addIceCandidate(iceCandidatesQueue.current.shift()!);
              }
              
              const answer = await pcLocal.createAnswer();
              await pcLocal.setLocalDescription(answer);
              send(ws, { type: 'ANSWER', payload: answer });
            } 
            else if (msg.type === 'ANSWER') {
              await pcLocal.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
              gotRemoteDescRef.current = true;
              while (iceCandidatesQueue.current.length > 0) {
                await pcLocal.addIceCandidate(iceCandidatesQueue.current.shift()!);
              }
            } 
            else if (msg.type === 'ICE_CANDIDATE') {
              const candidate = new RTCIceCandidate(msg.payload);
              if (pcLocal.remoteDescription) {
                await pcLocal.addIceCandidate(candidate);
              } else {
                iceCandidatesQueue.current.push(candidate);
              }
            } 
            else if (msg.type === 'END') {
              ws.close();
              navigate(-1);
            }
          } catch (err) {
            safeErr('Error manejando WS message', err);
          }
        };

        ws.onerror = (ev) => {
          safeErr('WS ERROR', ev);
          updateDebug({ wsState: 'ERROR', lastMsg: 'ws-error' });
          setConnState('Error de conexión');
        };

        ws.onclose = (ev) => {
          wsOpenRef.current = false;
          updateDebug({ wsState: 'CLOSED', lastMsg: `ws-close(${ev.code})` });
          if (!errorMsg) setConnState('Desconectado');
        };

      } catch (e: any) {
        safeErr('init error', e);
        setErrorMsg('Error inicializando la llamada.');
      }
    };

    init();

    const hb = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) send(wsRef.current, { type: 'HEARTBEAT' });
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(hb);
      try { wsRef.current?.close(); } catch { }
      try { pcRef.current?.close(); } catch { }
      
      const stopAll = (s: MediaStream | null) => s?.getTracks().forEach((trk) => trk.stop());
      stopAll(screenStreamRef.current);
      stopAll(camStreamRef.current);
      
      wsOpenRef.current = false;
      safeLog('UNMOUNT CallPage');
    };
  }, [sessionId, reservationId, token, auth.isLoading, auth.isAuthenticated]);


  // --- Handlers de Controles ---
  const onToggleMic = () => {
    const s: MediaStream | null = (localVideo.current?.srcObject as MediaStream) || camStreamRef.current;
    s?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  };

  const onToggleCam = () => {
    const s: MediaStream | null = (localVideo.current?.srcObject as MediaStream) || camStreamRef.current;
    s?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
  };

  const stopScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const camStream = camStreamRef.current;
    const screenStream = screenStreamRef.current;

    const camTrack = camStream?.getVideoTracks()[0];
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');

    if (sender && camTrack) {
      await sender.replaceTrack(camTrack);
      if (localVideo.current && camStream) localVideo.current.srcObject = camStream;
    }
    screenStream?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsSharing(false);
  };

  const onShareScreen = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (isSharing) return stopScreenShare();

    try {
      const displayStream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      else displayStream.getTracks().forEach(t => pc.addTrack(t, displayStream));

      if (localVideo.current) localVideo.current.srcObject = displayStream;
      screenStreamRef.current = displayStream;
      setIsSharing(true);

      screenTrack.addEventListener('ended', () => stopScreenShare().catch(() => {}));
    } catch (err) {
      safeErr('getDisplayMedia failed', err);
    }
  };

  const onEnd = () => navigate(-1);

  // --- Render ---

  if (auth.isLoading) return <div className="call-loading">Cargando autenticación...</div>;
  
  if (errorMsg) return (
    <div className="call-error">
      <h2>Ocurrió un error</h2>
      <p>{errorMsg}</p>
      <pre>
        Session ID: {sessionId}{"\n"}
        User: {userId || 'Desconocido'}
      </pre>
      <button onClick={() => navigate(-1)} className="btn-connect-header" style={{marginTop: '1rem'}}>
        Volver
      </button>
    </div>
  );

  return (
    <div className="call-page-container">
      {/* Header */}
      <div className="call-header">
        <h1>Sesión en Vivo</h1>
        
        <div className="call-meta">
          <div className="status-badge">
            <div className={`status-dot ${getStatusClass(connState)}`} />
            <span className="status-text">{connState}</span>
          </div>
        </div>

        
      </div>

      {/* Video Area */}
      <div className="video-grid">
        <div className="remote-video-wrapper">
          <video ref={remoteVideo} autoPlay playsInline className="remote-video" />
        </div>
        
        <div className="local-video-wrapper">
          <video ref={localVideo} autoPlay muted playsInline className="local-video" />
        </div>
      </div>

      {/* Debug Info (Overlay Discreto) */}
      <div className="debug-panel">
        <strong>Información Técnica</strong>
        <div>WS State: {debug.wsState}</div>
        <div>Signaling: {debug.pcSignaling}</div>
        <div>ICE State: {debug.pcIce}</div>
        <div>Local Media: {debug.hasLocalMedia}</div>
        <div>Sharing: {isSharing ? 'Yes' : 'No'}</div>
        <div style={{marginTop: 4, opacity: 0.7}}>{debug.lastMsg}</div>
      </div>

      {/* Controls */}
      <div className="controls-dock">
        <CallControls
          onToggleMic={onToggleMic}
          onToggleCam={onToggleCam}
          onShareScreen={onShareScreen}
          onEnd={onEnd}
        />
      </div>
    </div>
  );
}