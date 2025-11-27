import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useLocation, useParams } from 'react-router-dom';
import { createCallSession, getIceServers } from '../service/Api-call';
import '../styles/CallPage.css';

// ... (Tipos y funciones auxiliares wsProto, tuneOpusInSdp, normalizeIceServers se mantienen igual) ...
type WsEnvelope = {
  type:
    | 'JOIN' | 'JOIN_ACK' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE'
    | 'RTC_CONNECTED' | 'HEARTBEAT' | 'PEER_JOINED' | 'PEER_LEFT'
    | 'END' | 'ERROR';
  sessionId: string;
  reservationId?: string;
  from?: string;
  to?: string;
  payload?: any;
  ts?: number;
  traceId?: string;
};
type JoinAckPayload = { initiator?: boolean };

function wsProto() {
  return location.protocol === 'https:' ? 'wss' : 'ws';
}

function tuneOpusInSdp(sdp?: string) {
  if (!sdp) return sdp;
  return sdp.replace(/a=fmtp:(\d+) ([^\r\n]*)/g, (m, pt, p) => {
    if (!/useinbandfec=/.test(p)) p += ';useinbandfec=1';
    if (!/usedtx=/.test(p)) p += ';usedtx=1';
    if (!/stereo=/.test(p)) p += ';stereo=0';
    if (!/maxaveragebitrate=/.test(p)) p += ';maxaveragebitrate=24000';
    if (!/ptime=/.test(p)) p += ';ptime=20';
    return `a=fmtp:${pt} ${p}`;
  });
}

function normalizeIceServers(raw: any): RTCIceServer[] {
  const servers: RTCIceServer[] = [];
  const ok = (u: string) => /^(stun:|turns?:)/i.test(u) && !u.trim().startsWith('#') && !u.trim().startsWith('//');
  const push = (u: string, src?: any) => {
    const url = (u || '').trim();
    if (!ok(url)) return;
    const ice: RTCIceServer = { urls: url };
    if (src?.username) ice.username = src.username;
    if (src?.credential) ice.credential = src.credential;
    servers.push(ice);
  };
  if (Array.isArray(raw)) {
    raw.forEach((e) => {
      if (typeof e === 'string') push(e);
      else if (e && typeof e === 'object') {
        const urls = e.urls ?? e.url;
        if (Array.isArray(urls)) urls.forEach((u) => push(u, e));
        else if (typeof urls === 'string') push(urls, e);
      }
    });
  } else if (raw && typeof raw === 'object') {
    const urls = raw.urls ?? raw.url;
    if (Array.isArray(urls)) urls.forEach((u) => push(u, raw));
    else if (typeof urls === 'string') push(urls, raw);
  }
  if (!servers.length) servers.push({ urls: 'stun:stun.l.google.com:19302' });
  return servers;
}

// ... (CallChatButton y CallControls se mantienen igual) ...
function CallChatButton({ onOpen }: { onOpen?: () => void }) {
  return (
    <button
      className="px-3 py-2 rounded-md border text-white bg-indigo-600 hover:bg-indigo-700 transition"
      onClick={() => {
        globalThis.dispatchEvent(new CustomEvent('open-chat-drawer'));
        onOpen?.();
      }}
    >
      Chat
    </button>
  );
}

function CallControls(props: {
  onToggleMic: () => void;
  onToggleCam: () => void;
  onShareScreen: () => void;
  onEnd: () => void;
  isMicOn: boolean;
  isCamOn: boolean;
  isSharing: boolean;
}) {
  const { onToggleMic, onToggleCam, onShareScreen, onEnd, isMicOn, isCamOn, isSharing } = props;
  return (
    <div className="call-controls-group">
      <button onClick={onToggleMic} className={`call-btn ${isMicOn ? '' : 'off'}`} title={isMicOn ? 'Apagar micrófono' : 'Encender micrófono'}>
        {isMicOn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M19 10v2a7 7 0 0 1-2.9 5.69M5 10v2a7 7 0 0 0 11.08 5.76" /></svg>
        )}
      </button>
      <button onClick={onToggleCam} className={`call-btn ${isCamOn ? '' : 'off'}`} title={isCamOn ? 'Apagar cámara' : 'Encender cámara'}>
        {isCamOn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" /></svg>
        )}
      </button>
      <button onClick={onShareScreen} className={`call-btn ${isSharing ? 'active-share' : ''}`} title="Compartir pantalla">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /><path d="m16 8-4-4-4 4" /></svg>
      </button>
      <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', margin: '0 4px', height: 32 }} />
      <button onClick={onEnd} className="call-btn danger" title="Finalizar llamada">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
      </button>
    </div>
  );
}

export default function CallPage() {
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>();
  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const auth = useAuth();
  const token = useMemo(() => auth.user?.id_token || auth.user?.access_token || '', [auth.user]);
  const userId = useMemo(
    () => (auth.user?.profile as any)?.sub || (auth.user?.profile as any)?.userId || (auth.user?.profile as any)?.preferred_username || '',
    [auth.user],
  );

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'closed'>('idle');
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdParam);
  const [reservationId, setReservationId] = useState<string | undefined>(search.get('reservationId') || undefined);

  // 1. Refs para elementos de Video (CRUCIAL: Usar Refs en lugar de getElementById)
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const sidRef = useRef<string | undefined>(sessionId);
  const ridRef = useRef<string | undefined>(reservationId);
  useEffect(() => { sidRef.current = sessionId; }, [sessionId]);
  useEffect(() => { ridRef.current = reservationId; }, [reservationId]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const audioTxRef = useRef<RTCRtpTransceiver | null>(null);
  const videoTxRef = useRef<RTCRtpTransceiver | null>(null);

  const wsReadyRef = useRef(false);
  const ackReadyRef = useRef(false);
  const initiatorRef = useRef(false);
  const negotiationReadyRef = useRef(false);
  const peerPresentRef = useRef(false);

  const politeRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const sentRtcConnectedRef = useRef(false);
  const hbTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const mediaReadyRef = useRef(false);
  
  // 2. Ref para candidatos pendientes
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);

  const [isMicOn, setMicOn] = useState(true);
  const [isCamOn, setCamOn] = useState(true);
  const [isSharing, setSharing] = useState(false);

  const [debug, setDebug] = useState({
    signaling: 'new', ice: 'new', gathering: 'new',
    localTracks: { audio: 0, video: 0 },
    remoteTracks: { audio: 0, video: 0 },
  });
  const log = useCallback((...a: any[]) => console.log('[CALL]', ...a), []);

  const cleanup = useCallback(() => {
    if (hbTimerRef.current) window.clearInterval(hbTimerRef.current);
    hbTimerRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    wsReadyRef.current = false;
    ackReadyRef.current = false;
    negotiationReadyRef.current = false;
    peerPresentRef.current = false;
    
    pcRef.current?.getSenders().forEach((s) => s.track && s.track.stop());
    pcRef.current?.close();
    pcRef.current = null;
    
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    
    mediaReadyRef.current = false;
    pendingCandidatesRef.current = [];
    
    setSharing(false);
    setMicOn(true);
    setCamOn(true);
    setStatus('closed');
  }, []);

  const sendWs = useCallback((msg: Partial<WsEnvelope>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sidRef.current) return;
    const env: WsEnvelope = {
      type: msg.type as any,
      sessionId: sidRef.current,
      reservationId: ridRef.current,
      from: userId,
      ts: Date.now(),
      ...msg,
    } as WsEnvelope;
    try {
      ws.send(JSON.stringify(env));
      if (env.type !== 'HEARTBEAT') log('WS SEND =>', { type: env.type, sessionId: env.sessionId });
    } catch {}
  }, [userId, log]);

  const notifyRtcConnected = useCallback(() => {
    if (sentRtcConnectedRef.current) return;
    sentRtcConnectedRef.current = true;
    sendWs({ type: 'RTC_CONNECTED' });
  }, [sendWs]);

  const maybeNegotiate = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (!initiatorRef.current) return;
    if (!wsReadyRef.current || !ackReadyRef.current) return;
    if (!peerPresentRef.current) return;
    if (!mediaReadyRef.current) return;
    if (pc.signalingState !== 'stable') return;
    if (makingOfferRef.current) return;

    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      offer.sdp = tuneOpusInSdp(offer.sdp);
      await pc.setLocalDescription(offer);
      sendWs({ type: 'OFFER', payload: pc.localDescription });
      log('negotiation: sent OFFER');
    } catch (e) {
      console.error('Error creating offer:', e);
    } finally {
      makingOfferRef.current = false;
    }
  }, [sendWs, log]);

  const buildPeer = useCallback(async () => {
    const raw = await getIceServers().catch(() => []);
    const iceServers = normalizeIceServers(raw);
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2 });
    pcRef.current = pc;

    audioTxRef.current = pc.addTransceiver('audio', { direction: 'sendrecv' });
    videoTxRef.current = pc.addTransceiver('video', { direction: 'sendrecv' });

    // Inicializar remote stream
    remoteStreamRef.current = new MediaStream();

    pc.ontrack = (ev) => {
        const stream = remoteStreamRef.current;
        if (!stream) return;
        
        // Agregar track si no existe
        if (!stream.getTracks().some(t => t.id === ev.track.id)) {
            stream.addTrack(ev.track);
        }

        // 3. Asignar a los Refs de React (¡Aquí estaba el fallo visual!)
        if (remoteVideoRef.current && ev.track.kind === 'video') {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.play().catch(e => console.warn('Remote video play error', e));
        }
        if (remoteAudioRef.current && ev.track.kind === 'audio') {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch(e => console.warn('Remote audio play error', e));
        }

        setDebug((d) => ({
            ...d,
            remoteTracks: { audio: stream.getAudioTracks().length, video: stream.getVideoTracks().length },
        }));
    };

    pc.onicecandidate = (e) => {
      if (!wsReadyRef.current || !ackReadyRef.current) return;
      if (e.candidate) sendWs({ type: 'ICE_CANDIDATE', payload: e.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      setDebug((d) => ({ ...d, ice: st }));
      if (st === 'connected' || st === 'completed') {
        setStatus('connected');
        notifyRtcConnected();
      } else if (st === 'failed') {
        setStatus('failed');
      }
    };
    pc.onsignalingstatechange = () => setDebug((d) => ({ ...d, signaling: pc.signalingState }));
    pc.onicegatheringstatechange = () => setDebug((d) => ({ ...d, gathering: pc.iceGatheringState }));

    pc.onnegotiationneeded = () => { maybeNegotiate(); };
    (pc as any).__maybeNegotiate = maybeNegotiate;

    return pc;
  }, [notifyRtcConnected, sendWs, log, maybeNegotiate]);

  const acquireLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
        });
        localStreamRef.current = media;
        
        // Asignar al Ref local
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = media;
            localVideoRef.current.muted = true; // Siempre muteado localmente para evitar eco
            localVideoRef.current.play().catch(() => {});
        }

        setDebug((d) => ({
          ...d,
          localTracks: { audio: media.getAudioTracks().length, video: media.getVideoTracks().length },
        }));
        return media;
    } catch (e) {
        console.error("Error acquiring media", e);
        return null;
    }
  }, []);

  const addTracksToPc = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    
    await acquireLocalMedia();
    const stream = localStreamRef.current;
    if (!stream) return;

    const a = stream.getAudioTracks()[0];
    const v = stream.getVideoTracks()[0];
    
    if (audioTxRef.current && a) {
      await audioTxRef.current.sender.replaceTrack(a);
      audioTxRef.current.direction = 'sendrecv';
    }
    if (videoTxRef.current && v) {
      await videoTxRef.current.sender.replaceTrack(v);
      videoTxRef.current.direction = 'sendrecv';
    }
    
    mediaReadyRef.current = true;
    if (initiatorRef.current) {
        (pc as any).__maybeNegotiate?.();
    }
  }, [acquireLocalMedia]);

  const onWsMessage = useCallback(async (ev: MessageEvent) => {
    const pc = pcRef.current;
    if (!pc) return;
    const msg: WsEnvelope = JSON.parse(ev.data);
    
    if (msg.type !== 'HEARTBEAT') log('WS RECV <=', { type: msg.type, from: msg.from });

    // Filtros iniciales
    if (msg.from === userId && msg.type !== 'JOIN_ACK') return;
    if (msg.sessionId && sidRef.current && msg.sessionId !== sidRef.current && msg.type !== 'JOIN_ACK') return;

    if (msg.type === 'JOIN_ACK') {
        const payload = (msg.payload || {}) as JoinAckPayload;
        politeRef.current = !payload.initiator;
        initiatorRef.current = !!payload.initiator;
        ackReadyRef.current = true;
        
        // Si hay cambio de session/reservation
        if (msg.sessionId) { sidRef.current = msg.sessionId; setSessionId(msg.sessionId); }
        if (msg.reservationId) { ridRef.current = msg.reservationId; setReservationId(msg.reservationId); }
        
        wsReadyRef.current = true; // Asegurar flag
        await addTracksToPc(); 
    }
    else if (msg.type === 'PEER_JOINED') {
        peerPresentRef.current = true;
        if (initiatorRef.current && mediaReadyRef.current) {
            (pc as any).__maybeNegotiate?.();
        }
    }
    else if (msg.type === 'OFFER') {
        await addTracksToPc();
        const remote: RTCSessionDescriptionInit = msg.payload;
        const making = makingOfferRef.current;
        const stable = pc.signalingState === 'stable';
        const glare = remote.type === 'offer' && (making || !stable);

        if (glare && !politeRef.current) {
             ignoreOfferRef.current = true; 
             return; 
        }
        ignoreOfferRef.current = false;

        if (glare && politeRef.current) {
            await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(remote);
        
        // 4. PROCESAR CANDIDATOS ENCOLADOS
        if (pendingCandidatesRef.current.length > 0) {
            log('Processing pending ICE candidates:', pendingCandidatesRef.current.length);
            for (const c of pendingCandidatesRef.current) {
                await pc.addIceCandidate(c).catch(e => console.error(e));
            }
            pendingCandidatesRef.current = [];
        }

        const answer = await pc.createAnswer();
        answer.sdp = tuneOpusInSdp(answer.sdp);
        await pc.setLocalDescription(answer);
        sendWs({ type: 'ANSWER', payload: pc.localDescription });
    }
    else if (msg.type === 'ANSWER') {
        if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(msg.payload);
             // Procesar candidatos también aquí por seguridad
             if (pendingCandidatesRef.current.length > 0) {
                for (const c of pendingCandidatesRef.current) {
                    await pc.addIceCandidate(c).catch(e => console.error(e));
                }
                pendingCandidatesRef.current = [];
            }
        }
    }
    else if (msg.type === 'ICE_CANDIDATE') {
        if (ignoreOfferRef.current || !msg.payload) return;
        const candidate = new RTCIceCandidate(msg.payload);
        
        // 5. ENCOLAR SI NO HAY REMOTE DESCRIPTION
        if (!pc.remoteDescription || pc.remoteDescription.type === 'rollback') {
            pendingCandidatesRef.current.push(candidate);
        } else {
            await pc.addIceCandidate(candidate).catch(e => console.error('AddIce error', e));
        }
    }
    else if (msg.type === 'END') {
        cleanup();
    }
  }, [addTracksToPc, cleanup, sendWs, log, userId]);

  const start = useCallback(async () => {
    setStatus('connecting');
    await buildPeer();
    await acquireLocalMedia();

    const ws = new WebSocket(`${wsProto()}://localhost:8093/ws/call?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = async () => {
      wsReadyRef.current = true;
      let sid = sidRef.current;
      if (!sid) {
         if (!ridRef.current) throw new Error('Falta reservationId');
         const created = await createCallSession(ridRef.current, token);
         sid = created.sessionId;
         setSessionId(sid); sidRef.current = sid;
         setReservationId(created.reservationId); ridRef.current = created.reservationId;
      }
      ws.send(JSON.stringify({ type: 'JOIN', sessionId: sid, reservationId: ridRef.current, from: userId, ts: Date.now() }));
      hbTimerRef.current = window.setInterval(() => sendWs({ type: 'HEARTBEAT' }), 10000) as unknown as number;
    };

    ws.onmessage = onWsMessage;
    ws.onclose = () => { if (status !== 'closed') setStatus('failed'); };
  }, [acquireLocalMedia, buildPeer, onWsMessage, sendWs, token, userId, status]);

  const endCall = useCallback(() => { sendWs({ type: 'END' }); cleanup(); }, [cleanup, sendWs]);

  // Controles
  const toggleMic = useCallback(() => {
     const t = localStreamRef.current?.getAudioTracks()[0];
     if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  }, []);
  const toggleCam = useCallback(() => {
     const t = localStreamRef.current?.getVideoTracks()[0];
     if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  }, []);
  
  const shareScreen = useCallback(async () => {
    if (!videoTxRef.current?.sender) return;
    if (!isSharing) {
        try {
            const display = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
            const vTrack = display.getVideoTracks()[0];
            await videoTxRef.current.sender.replaceTrack(vTrack);
            setSharing(true);
            vTrack.onended = async () => {
                const cam = localStreamRef.current?.getVideoTracks()[0];
                await videoTxRef.current?.sender.replaceTrack(cam || null);
                setSharing(false);
            };
        } catch {}
    } else {
        const cam = localStreamRef.current?.getVideoTracks()[0];
        await videoTxRef.current.sender.replaceTrack(cam || null);
        setSharing(false);
    }
  }, [isSharing]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
    return () => cleanup();
  }, []);

  return (
    <div className="call-page-container">
      <div className="call-header">
        <h1>Sesión de llamada</h1>
        <div className="call-meta">
          <div className="status-badge">
            <span className={`status-dot ${status === 'connected' ? 'connected' : 'failed'}`} />
            <span>{status}</span>
          </div>
          <CallChatButton />
        </div>
      </div>

      <div className="video-grid">
        <div className="remote-video-wrapper">
          {/* USAR REFS AQUÍ */}
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          <div className="local-video-wrapper">
            <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
          </div>
        </div>
      </div>

      <div className="controls-dock">
        <CallControls 
            onToggleMic={toggleMic} onToggleCam={toggleCam} onShareScreen={shareScreen} onEnd={endCall}
            isMicOn={isMicOn} isCamOn={isCamOn} isSharing={isSharing} 
        />
      </div>

      {/* Audio remoto oculto */}
      <audio ref={remoteAudioRef} style={{ display: 'none' }} autoPlay />

      <div className="debug-panel">
        <strong>Debug</strong>
        <div>signaling: {debug.signaling} / ice: {debug.ice}</div>
        <div>local: a{debug.localTracks.audio}v{debug.localTracks.video} / remote: a{debug.remoteTracks.audio}v{debug.remoteTracks.video}</div>
      </div>
    </div>
  );
}