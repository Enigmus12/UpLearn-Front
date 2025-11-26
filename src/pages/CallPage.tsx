import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useParams, useNavigate } from 'react-router-dom';
import CallControls from '../components/llamada/CallControls';
import { getIceServers } from '../service/Api-call';
import '../styles/CallPage.css';

// ---------------- Tipos ----------------

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

const getStatusClass = (state: string) => {
  const s = (state || '').toLowerCase();
  if (s === 'connected' || s === 'completed' || s === 'stable') return 'connected';
  if (s.includes('fail') || s.includes('close') || s.includes('error')) return 'failed';
  return '';
};

// ---------------- Componente principal ----------------

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

  // Refs de RTC y WS
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Elementos de Video
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  // Streams
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Estado UI
  const [connState, setConnState] = useState<string>('Inicializando...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Flags internos para negociación
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  const wsOpenRef = useRef(false);
  const joinAckRef = useRef(false);
  const sentOfferRef = useRef(false);
  const gotRemoteDescRef = useRef(false);
  const isOffererRef = useRef(false);         // 👈 quién manda OFFER
  const sentRtcConnectedRef = useRef(false);  // para mandar RTC_CONNECTED solo 1 vez

  // Debug
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

  // ------------- Helper WS -------------

  const send = (wsInstance: WebSocket | null, env: Partial<Envelope>) => {
    if (!wsInstance) { safeWarn('send(): ws null'); return; }
    if (wsInstance.readyState !== WebSocket.OPEN) {
      safeWarn('send(): ws not OPEN, state=', wsInstance.readyState);
      return;
    }
    if (!sessionId) {
      safeWarn('send(): no sessionId');
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

  // ------------- Negociación: OFFER -------------

  const maybeStartOffer = async () => {
    const pc = pcRef.current;
    if (!pc) {
      safeWarn('maybeStartOffer(): no pc');
      return;
    }
    if (sentOfferRef.current) return;

    // Solo el peer marcado como "offerer" debe crear y enviar la OFFER
    if (!isOffererRef.current) {
      safeLog('maybeStartOffer(): soy peer pasivo, no envío OFFER');
      return;
    }

    const hasMedia = !!camStreamRef.current;
    if (!wsOpenRef.current || !joinAckRef.current || !hasMedia) {
      safeLog('maybeStartOffer(): esperando condiciones', {
        wsOpen: wsOpenRef.current,
        joinAck: joinAckRef.current,
        hasMedia,
      });
      return;
    }

    try {
      sentOfferRef.current = true;
      safeLog('Creando y enviando OFFER…');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      send(wsRef.current, { type: 'OFFER', payload: offer });
    } catch (e) {
      sentOfferRef.current = false;
      safeErr('maybeStartOffer error', e);
    }
  };

  // ------------- Efecto principal -------------

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

        // -------- Media local optimizada (audio limpio + poco ancho de banda) --------
        setConnState('Accediendo a dispositivos...');
        safeLog('Solicitando getUserMedia…');

        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 360, max: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
        };

        const camStream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          camStream.getTracks().forEach((t) => t.stop());
          return;
        }

        camStreamRef.current = camStream;

        if (localVideo.current) {
          localVideo.current.srcObject = camStream;
        }

        camStream.getTracks().forEach((track: MediaStreamTrack) => {
          pcLocal.addTrack(track, camStream);
        });

        // Limitar bitrate de video para no consumir mucho ancho de banda
        pcLocal.getSenders().forEach((sender) => {
          if (!sender.track || sender.track.kind !== 'video') return;
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 600_000;   // ~600 kbps
          params.encodings[0].maxFramerate = 24;
          sender.setParameters(params).catch((err) => safeWarn('setParameters(video) failed', err));
        });

        updateDebug({ hasLocalMedia: 'sí' });
        void maybeStartOffer();

        // -------- Eventos RTC --------
        pcLocal.ontrack = (ev) => {
          safeLog('ontrack: stream remoto recibido');
          const [stream] = ev.streams;
          if (remoteVideo.current && stream) {
            remoteVideo.current.srcObject = stream;
          }
        };

        pcLocal.onicecandidate = (ev) => {
          if (ev.candidate) {
            send(wsRef.current, { type: 'ICE_CANDIDATE', payload: ev.candidate });
          }
        };

        pcLocal.oniceconnectionstatechange = () => {
          updateDebug({ pcIce: pcLocal.iceConnectionState });
        };

        pcLocal.onsignalingstatechange = () => {
          updateDebug({ pcSignaling: pcLocal.signalingState });
        };

        pcLocal.onconnectionstatechange = () => {
          const state = pcLocal.connectionState;
          setConnState(state);
          updateDebug({
            pcSignaling: pcLocal.signalingState,
            pcIce: pcLocal.iceConnectionState,
          });

          if (state === 'connected' && !sentRtcConnectedRef.current) {
            sentRtcConnectedRef.current = true;
            send(wsRef.current, { type: 'RTC_CONNECTED' });
          }
        };

        // -------- WebSocket --------
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
          if (!isMounted) return;
          wsOpenRef.current = true;
          updateDebug({ wsState: 'OPEN', lastMsg: 'ws-open' });
          send(ws, { type: 'JOIN' });
          void maybeStartOffer();
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
            const payloadAny: any = msg.payload ?? {};
            const initiator = !!payloadAny.initiator;
            // en el server: initiator == true para el PRIMERO que entra
            // el segundo en entrar será el offerer
            isOffererRef.current = !initiator;
            joinAckRef.current = true;
            safeLog('JOIN_ACK recibido', { initiator, isOfferer: isOffererRef.current });
            void maybeStartOffer();
            return;
          }

          // Ignorar mensajes enviados por mí mismo
          if (msg.from === userId) {
            return;
          }

          try {
            // ---------- OFFER ----------
            if (msg.type === 'OFFER') {
              // Solo el que NO es offerer maneja la OFFER
              if (isOffererRef.current) {
                safeWarn('Soy offerer y recibí OFFER; la ignoro (evitar glare)');
                return;
              }

              if (pcLocal.signalingState !== 'stable') {
                safeWarn('Ignorando OFFER: estado de signaling=', pcLocal.signalingState);
                return;
              }

              const offerDesc = msg.payload as RTCSessionDescriptionInit;
              await pcLocal.setRemoteDescription(offerDesc);
              gotRemoteDescRef.current = true;

              // aplicar candidatos acumulados
              while (iceCandidatesQueue.current.length > 0) {
                await pcLocal.addIceCandidate(iceCandidatesQueue.current.shift()!);
              }

              const answer = await pcLocal.createAnswer();
              await pcLocal.setLocalDescription(answer);
              send(ws, { type: 'ANSWER', payload: answer });
            }

            // ---------- ANSWER ----------
            else if (msg.type === 'ANSWER') {
              // Solo el offerer maneja ANSWER
              if (!isOffererRef.current) {
                safeWarn('No soy offerer y recibí ANSWER; la ignoro');
                return;
              }

              if (pcLocal.signalingState !== 'have-local-offer') {
                safeWarn('Ignorando ANSWER: signaling=', pcLocal.signalingState);
                return;
              }

              const answerDesc = msg.payload as RTCSessionDescriptionInit;
              await pcLocal.setRemoteDescription(answerDesc);
              gotRemoteDescRef.current = true;

              while (iceCandidatesQueue.current.length > 0) {
                await pcLocal.addIceCandidate(iceCandidatesQueue.current.shift()!);
              }
            }

            // ---------- ICE ----------
            else if (msg.type === 'ICE_CANDIDATE') {
              const candidate = new RTCIceCandidate(msg.payload);
              if (pcLocal.remoteDescription) {
                await pcLocal.addIceCandidate(candidate);
              } else {
                iceCandidatesQueue.current.push(candidate);
              }
            }

            // ---------- END ----------
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

    void init();

    // Heartbeat
    const hb = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        send(wsRef.current, { type: 'HEARTBEAT' });
      }
    }, 10000);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(hb);

      try { wsRef.current?.close(); } catch { /* ignore */ }
      try { pcRef.current?.close(); } catch { /* ignore */ }

      const stopAll = (s: MediaStream | null) =>
        s?.getTracks().forEach((trk) => trk.stop());
      stopAll(screenStreamRef.current);
      stopAll(camStreamRef.current);

      wsOpenRef.current = false;
      safeLog('UNMOUNT CallPage');
    };
  }, [sessionId, reservationId, token, auth.isLoading, auth.isAuthenticated]);

  // ------------- Handlers de controles -------------

  const onToggleMic = () => {
    const s: MediaStream | null =
      (localVideo.current?.srcObject as MediaStream) || camStreamRef.current;
    s?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
  };

  const onToggleCam = () => {
    const s: MediaStream | null =
      (localVideo.current?.srcObject as MediaStream) || camStreamRef.current;
    s?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
  };

  const stopScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const camStream = camStreamRef.current;
    const screenStream = screenStreamRef.current;

    const camTrack = camStream?.getVideoTracks()[0];
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');

    if (sender && camTrack) {
      await sender.replaceTrack(camTrack);
      if (localVideo.current && camStream) {
        localVideo.current.srcObject = camStream;
      }
    }

    screenStream?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsSharing(false);
  };

  const onShareScreen = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (isSharing) {
      return stopScreenShare();
    }

    try {
      const displayStream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 20 },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        displayStream.getTracks().forEach((t) => pc.addTrack(t, displayStream));
      }

      if (localVideo.current) {
        localVideo.current.srcObject = displayStream;
      }

      screenStreamRef.current = displayStream;
      setIsSharing(true);

      screenTrack.addEventListener('ended', () => {
        stopScreenShare().catch(() => {});
      });
    } catch (err) {
      safeErr('getDisplayMedia failed', err);
    }
  };

  const onEnd = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      send(wsRef.current, { type: 'END' });
    }
    navigate(-1);
  };

  // ------------- Render -------------

  if (auth.isLoading) {
    return <div className="call-loading">Cargando autenticación...</div>;
  }

  if (errorMsg) {
    return (
      <div className="call-error">
        <h2>Ocurrió un error</h2>
        <p>{errorMsg}</p>
        <pre>
          Session ID: {sessionId}
          {'\n'}
          User: {userId || 'Desconocido'}
        </pre>
        <button
          onClick={() => navigate(-1)}
          className="btn-connect-header"
          style={{ marginTop: '1rem' }}
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="call-page-container">
      <div className="call-header">
        <h1>Sesión en Vivo</h1>

        <div className="call-meta">
          <div className="status-badge">
            <div className={`status-dot ${getStatusClass(connState)}`} />
            <span className="status-text">{connState}</span>
          </div>
        </div>
      </div>

      <div className="video-grid">
        <div className="remote-video-wrapper">
          <video ref={remoteVideo} autoPlay playsInline className="remote-video" />
        </div>

        <div className="local-video-wrapper">
          <video ref={localVideo} autoPlay muted playsInline className="local-video" />
        </div>
      </div>

      <div className="debug-panel">
        <strong>Información Técnica</strong>
        <div>WS State: {debug.wsState}</div>
        <div>Signaling: {debug.pcSignaling}</div>
        <div>ICE State: {debug.pcIce}</div>
        <div>Local Media: {debug.hasLocalMedia}</div>
        <div>Sharing: {isSharing ? 'Yes' : 'No'}</div>
        <div style={{ marginTop: 4, opacity: 0.7 }}>{debug.lastMsg}</div>
      </div>

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
