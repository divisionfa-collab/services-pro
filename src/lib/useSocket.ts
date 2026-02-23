'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  GameSession,
  PhaseChangeData,
  TimerData,
  Player,
  RoleAssignment,
  NightTargetData,
  MorningResult,
  GameOverData,
  VoteUpdateData,
  VoteResultData,
  ChatMessage,
  MafiaChatMessage,
  DetectiveResult,
} from '@/types/game';

const SOCKET_URL = typeof window !== 'undefined'
  ? (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001')
  : 'http://localhost:3001';
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  isConnected: boolean;
  session: GameSession | null;
  playerId: string | null;
  myRole: RoleAssignment | null;
  phaseData: PhaseChangeData | null;
  timerData: TimerData | null;
  nightTarget: NightTargetData | null;
  morningResult: MorningResult | null;
  voteUpdate: VoteUpdateData | null;
  voteResult: VoteResultData | null;
  messages: ChatMessage[];
  mafiaMessages: MafiaChatMessage[];
  detectiveResult: DetectiveResult | null;
  detectiveHistory: DetectiveResult[];
  doctorConfirm: string | null;
  detectiveConfirm: string | null;
  gameOver: GameOverData | null;
  error: string | null;
  createSession: (playerName: string) => Promise<boolean>;
  joinSession: (code: string, playerName: string) => Promise<boolean>;
  startGame: () => Promise<boolean>;
  selectNightTarget: (targetId: string) => Promise<boolean>;
  doctorProtect: (targetId: string) => Promise<boolean>;
  detectiveCheck: (targetId: string) => Promise<boolean>;
  sendMafiaChat: (text: string) => Promise<boolean>;
  castVote: (targetId: string) => Promise<boolean>;
  sendMessage: (text: string) => Promise<boolean>;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<RoleAssignment | null>(null);
  const [phaseData, setPhaseData] = useState<PhaseChangeData | null>(null);
  const [timerData, setTimerData] = useState<TimerData | null>(null);
  const [nightTarget, setNightTarget] = useState<NightTargetData | null>(null);
  const [morningResult, setMorningResult] = useState<MorningResult | null>(null);
  const [voteUpdate, setVoteUpdate] = useState<VoteUpdateData | null>(null);
  const [voteResult, setVoteResult] = useState<VoteResultData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mafiaMessages, setMafiaMessages] = useState<MafiaChatMessage[]>([]);
  const [detectiveResult, setDetectiveResult] = useState<DetectiveResult | null>(null);
  const [detectiveHistory, setDetectiveHistory] = useState<DetectiveResult[]>([]);
  const [doctorConfirm, setDoctorConfirm] = useState<string | null>(null);
  const [detectiveConfirm, setDetectiveConfirm] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket: GameSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => { setIsConnected(true); setError(null); });
    socket.on('disconnect', () => { setIsConnected(false); });
    socket.on('session:updated', (s) => setSession(s));

    socket.on('phase:changed', (data) => {
      setPhaseData(data);
      if (data.phase === 'NIGHT') {
        setNightTarget(null);
        setMorningResult(null);
        setVoteUpdate(null);
        setVoteResult(null);
        setMessages([]);
        setMafiaMessages([]);
        setDetectiveResult(null);
        setDoctorConfirm(null);
        setDetectiveConfirm(null);
      }
      if (data.phase === 'DISCUSSION') {
        setMessages([]);
      }
      if (data.phase === 'VOTING') {
        setVoteUpdate(null);
        setVoteResult(null);
      }
    });

    socket.on('timer:tick', (data) => setTimerData(data));
    socket.on('player:joined', (p) => console.log(`👤 ${p.name} joined`));
    socket.on('player:left', (id) => console.log(`👋 ${id} left`));

    socket.on('role:assigned', (data) => setMyRole(data));
    socket.on('night:target_selected', (data) => setNightTarget(data));
    socket.on('night:doctor_selected', (data) => setDoctorConfirm(data.targetName));
    socket.on('night:detective_selected', (data) => setDetectiveConfirm(data.targetName));
    socket.on('morning:kill_result', (data) => setMorningResult(data));

    socket.on('detective:result', (data) => {
      setDetectiveResult(data);
      setDetectiveHistory(prev => [...prev, data]);
      // إخفاء بعد 5 ثواني
      setTimeout(() => setDetectiveResult(null), 5000);
    });

    socket.on('mafia:message', (msg) => setMafiaMessages(prev => [...prev, msg]));
    socket.on('vote:update', (data) => setVoteUpdate(data));
    socket.on('vote:result', (data) => setVoteResult(data));
    socket.on('chat:message', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('game:over', (data) => setGameOver(data));
    socket.on('error', (msg) => setError(msg));

    return () => { socket.disconnect(); };
  }, []);

  const emit = useCallback((event: string, ...args: any[]): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) { setError('غير متصل'); resolve(false); return; }
      (socketRef.current as any).emit(event, ...args, (r: any) => {
        if (r.success) { setError(null); resolve(true); }
        else { setError(r.error || 'فشل'); resolve(false); }
      });
    });
  }, []);

  return {
    isConnected, session, playerId, myRole, phaseData, timerData,
    nightTarget, morningResult, voteUpdate, voteResult, messages,
    mafiaMessages, detectiveResult, detectiveHistory, doctorConfirm, detectiveConfirm,
    gameOver, error,
    createSession: useCallback((n: string) => emit('session:create', n), [emit]),
    joinSession: useCallback((c: string, n: string) => emit('session:join', c, n), [emit]),
    startGame: useCallback(() => emit('game:start'), [emit]),
    selectNightTarget: useCallback((t: string) => emit('night:select_target', t), [emit]),
    doctorProtect: useCallback((t: string) => emit('night:doctor_protect', t), [emit]),
    detectiveCheck: useCallback((t: string) => emit('night:detective_check', t), [emit]),
    sendMafiaChat: useCallback((t: string) => emit('mafia:chat', t), [emit]),
    castVote: useCallback((t: string) => emit('vote:cast', t), [emit]),
    sendMessage: useCallback((t: string) => emit('chat:send', t), [emit]),
  };
}
