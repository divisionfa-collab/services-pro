// ============================================
// Doubt Game - Game Engine
// Sprint 6: Advanced Night System
// ============================================
// NIGHT → MORNING → DISCUSSION → REBUTTAL → VOTING → RESULT → NIGHT...
// ============================================

import {
  GamePhase,
  GameSession,
  Player,
  PlayerRole,
  WinResult,
  ChatMessage,
  MafiaChatMessage,
  NightActions,
  DetectiveResult,
  PhaseChangeData,
  TimerData,
  RoleAssignment,
  NightTargetData,
  MorningResult,
  GameOverData,
  VoteUpdateData,
  VoteResultData,
  VoteCount,
  PHASE_DURATIONS,
  PHASE_INFO,
  MAX_MESSAGES_PER_PHASE,
  MAX_MESSAGE_LENGTH,
  MAX_MAFIA_CHAT_LENGTH,
  MAX_MAFIA_MESSAGES,
  getRoleDistribution,
} from '../types/game';
import { PhaseTimer } from '../lib/timer';

// ============================================
// Helpers
// ============================================

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyNightActions(): NightActions {
  return {
    mafiaTarget: null,
    doctorProtect: null,
    detectiveCheck: null,
    lastDoctorProtect: null,
  };
}

// ============================================
// Storage
// ============================================

const sessions: Map<string, GameSession> = new Map();
const codeToSessionId: Map<string, string> = new Map();
const playerToSession: Map<string, string> = new Map();
const sessionTimers: Map<string, PhaseTimer> = new Map();

// ============================================
// Callbacks
// ============================================

interface EngineCallbacks {
  onPhaseChange: (sessionId: string, data: PhaseChangeData) => void;
  onTimerTick: (sessionId: string, data: TimerData) => void;
  onSessionUpdated: (sessionId: string, session: GameSession) => void;
  onRoleAssigned: (playerId: string, data: RoleAssignment) => void;
  onNightTargetSelected: (sessionId: string, data: NightTargetData, mafiaOnly: boolean) => void;
  onDoctorSelected: (playerId: string, data: { targetName: string }) => void;
  onDetectiveSelected: (playerId: string, data: { targetName: string }) => void;
  onMorningResult: (sessionId: string, data: MorningResult) => void;
  onDetectiveResult: (playerId: string, data: DetectiveResult) => void;
  onMafiaMessage: (sessionId: string, message: MafiaChatMessage) => void;
  onVoteUpdate: (sessionId: string, data: VoteUpdateData) => void;
  onVoteResult: (sessionId: string, data: VoteResultData) => void;
  onChatMessage: (sessionId: string, message: ChatMessage) => void;
  onGameOver: (sessionId: string, data: GameOverData) => void;
}

let callbacks: EngineCallbacks | null = null;

export function setCallbacks(cb: EngineCallbacks): void {
  callbacks = cb;
}

// ============================================
// Session Management
// ============================================

export function createSession(playerName: string, playerId: string): { session: GameSession; player: Player } {
  const sessionId = generateId();
  let code = generateCode();
  while (codeToSessionId.has(code)) { code = generateCode(); }

  const player: Player = {
    id: playerId, name: playerName, role: null, isAlive: true,
    isHost: true, isConnected: true, joinedAt: Date.now(),
  };

  const session: GameSession = {
    id: sessionId, code, players: [player],
    phase: GamePhase.LOBBY, round: 0,
    phaseStartedAt: 0, phaseEndsAt: 0,
    isStarted: false, isGameOver: false, winResult: null,
    nightActions: emptyNightActions(),
    lastKilled: null, lastKilledName: null, wasSaved: false,
    mafiaMessages: [], mafiaMsgCount: {},
    votes: {}, voteResult: null,
    messages: [], messageCount: {},
    createdAt: Date.now(),
  };

  sessions.set(sessionId, session);
  codeToSessionId.set(code, sessionId);
  playerToSession.set(playerId, sessionId);
  console.log(`🎮 Session created: ${code} by ${playerName}`);
  return { session, player };
}

export function joinSession(code: string, playerName: string, playerId: string): { session: GameSession; player: Player } | { error: string } {
  const sessionId = codeToSessionId.get(code.toUpperCase());
  if (!sessionId) return { error: 'كود الجلسة غير صحيح' };

  const session = sessions.get(sessionId);
  if (!session) return { error: 'الجلسة غير موجودة' };
  if (session.isStarted) return { error: 'اللعبة بدأت بالفعل' };
  if (session.players.length >= 12) return { error: 'الجلسة ممتلئة' };
  if (session.players.some(p => p.name === playerName)) return { error: 'الاسم مستخدم' };

  const player: Player = {
    id: playerId, name: playerName, role: null, isAlive: true,
    isHost: false, isConnected: true, joinedAt: Date.now(),
  };

  session.players.push(player);
  playerToSession.set(playerId, sessionId);
  console.log(`👤 ${playerName} joined ${code} (${session.players.length} players)`);
  return { session, player };
}

export function leaveSession(playerId: string): { sessionId: string; session: GameSession | null } | null {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;

  session.players = session.players.filter(p => p.id !== playerId);
  playerToSession.delete(playerId);

  if (session.players.length === 0) {
    destroySession(sessionId);
    return { sessionId, session: null };
  }

  if (!session.players.some(p => p.isHost)) {
    session.players[0].isHost = true;
  }

  if (session.isStarted && !session.isGameOver) {
    const winCheck = checkWinCondition(session);
    if (winCheck) { endGame(sessionId, winCheck); }
  }

  return { sessionId, session };
}

function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  const timer = sessionTimers.get(sessionId);
  if (timer) { timer.stop(); sessionTimers.delete(sessionId); }
  codeToSessionId.delete(session.code);
  session.players.forEach(p => playerToSession.delete(p.id));
  sessions.delete(sessionId);
}

// ============================================
// Role Assignment (Sprint 6)
// ============================================

function assignRoles(session: GameSession): void {
  const roles = getRoleDistribution(session.players.length);
  const shuffledRoles = shuffle(roles);

  session.players.forEach((player, index) => {
    player.role = shuffledRoles[index];
    player.isAlive = true;
  });

  const mafiaNames = session.players.filter(p => p.role === PlayerRole.MAFIA).map(p => p.name);

  session.players.forEach(player => {
    if (callbacks) {
      callbacks.onRoleAssigned(player.id, {
        role: player.role!,
        teammates: player.role === PlayerRole.MAFIA
          ? mafiaNames.filter(n => n !== player.name) : [],
      });
    }
  });

  const roleLog = session.players.map(p => {
    const icons: Record<string, string> = { MAFIA: '🔪', CITIZEN: '🏘️', DOCTOR: '🩺', DETECTIVE: '🕵️' };
    return `${icons[p.role!] || '?'} ${p.name}`;
  }).join(' | ');
  console.log(`🎭 Roles: ${roleLog}`);
}

// ============================================
// Game Start
// ============================================

export function startGame(playerId: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };

  const player = session.players.find(p => p.id === playerId);
  if (!player?.isHost) return { success: false, error: 'فقط المضيف' };
  if (session.isStarted) return { success: false, error: 'بدأت بالفعل' };
  if (session.players.length < 2) return { success: false, error: 'يجب لاعبان على الأقل' };

  session.isStarted = true;
  session.round = 1;
  console.log(`\n🚀 Game started: ${session.code} (${session.players.length} players)`);

  assignRoles(session);
  transitionToPhase(sessionId, GamePhase.NIGHT);
  return { success: true };
}

// ============================================
// Night Actions (Sprint 6)
// ============================================

/** المافيا تختار هدف القتل */
export function selectNightTarget(playerId: string, targetId: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };
  if (session.phase !== GamePhase.NIGHT) return { success: false, error: 'ليس وقت الليل' };

  const player = session.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: 'غير موجود' };
  if (player.role !== PlayerRole.MAFIA) return { success: false, error: 'لست مافيا' };
  if (!player.isAlive) return { success: false, error: 'أنت مُقصى' };

  const target = session.players.find(p => p.id === targetId);
  if (!target) return { success: false, error: 'هدف غير موجود' };
  if (!target.isAlive) return { success: false, error: 'الهدف مُقصى' };
  if (target.role === PlayerRole.MAFIA) return { success: false, error: 'لا تستهدف زميلك' };

  session.nightActions.mafiaTarget = targetId;

  if (callbacks) {
    callbacks.onNightTargetSelected(sessionId, {
      targetId: target.id, targetName: target.name, selectedBy: player.name,
    }, true);
  }
  return { success: true };
}

/** الطبيب يحمي لاعب */
export function doctorProtect(playerId: string, targetId: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };
  if (session.phase !== GamePhase.NIGHT) return { success: false, error: 'ليس وقت الليل' };

  const player = session.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: 'غير موجود' };
  if (player.role !== PlayerRole.DOCTOR) return { success: false, error: 'لست طبيب' };
  if (!player.isAlive) return { success: false, error: 'أنت مُقصى' };

  const target = session.players.find(p => p.id === targetId);
  if (!target) return { success: false, error: 'هدف غير موجود' };
  if (!target.isAlive) return { success: false, error: 'الهدف مُقصى' };

  // منع حماية نفس الشخص ليلتين متتاليتين
  if (session.nightActions.lastDoctorProtect === targetId) {
    return { success: false, error: 'لا يمكن حماية نفس الشخص ليلتين متتاليتين' };
  }

  session.nightActions.doctorProtect = targetId;

  if (callbacks) {
    callbacks.onDoctorSelected(playerId, { targetName: target.name });
  }
  return { success: true };
}

/** المحقق يفحص لاعب */
export function detectiveCheck(playerId: string, targetId: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };
  if (session.phase !== GamePhase.NIGHT) return { success: false, error: 'ليس وقت الليل' };

  const player = session.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: 'غير موجود' };
  if (player.role !== PlayerRole.DETECTIVE) return { success: false, error: 'لست محقق' };
  if (!player.isAlive) return { success: false, error: 'أنت مُقصى' };

  const target = session.players.find(p => p.id === targetId);
  if (!target) return { success: false, error: 'هدف غير موجود' };
  if (!target.isAlive) return { success: false, error: 'الهدف مُقصى' };
  if (target.id === playerId) return { success: false, error: 'لا يمكن فحص نفسك' };

  session.nightActions.detectiveCheck = targetId;

  if (callbacks) {
    callbacks.onDetectiveSelected(playerId, { targetName: target.name });
  }
  return { success: true };
}

/** قناة المافيا السرية */
export function sendMafiaChat(playerId: string, text: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };
  if (session.phase !== GamePhase.NIGHT) return { success: false, error: 'ليس وقت الليل' };

  const player = session.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: 'غير موجود' };
  if (player.role !== PlayerRole.MAFIA) return { success: false, error: 'لست مافيا' };
  if (!player.isAlive) return { success: false, error: 'أنت مُقصى' };

  const count = session.mafiaMsgCount[playerId] || 0;
  if (count >= MAX_MAFIA_MESSAGES) {
    return { success: false, error: 'استنفدت رسائلك' };
  }

  const cleanText = text.trim().slice(0, MAX_MAFIA_CHAT_LENGTH);
  if (cleanText.length === 0) return { success: false, error: 'رسالة فارغة' };

  const message: MafiaChatMessage = {
    id: generateId(),
    playerId: player.id,
    playerName: player.name,
    text: cleanText,
    timestamp: Date.now(),
  };

  session.mafiaMessages.push(message);
  session.mafiaMsgCount[playerId] = count + 1;

  if (callbacks) {
    callbacks.onMafiaMessage(sessionId, message);
  }
  return { success: true };
}

// ============================================
// Night Resolution (Sprint 6)
// ============================================

function executeNightKill(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const { mafiaTarget, doctorProtect: protect, detectiveCheck: check } = session.nightActions;

  let killed = false;
  let killedName: string | null = null;
  let killedId: string | null = null;
  let wasSaved = false;

  // 1. حل القتل
  if (mafiaTarget) {
    if (protect && mafiaTarget === protect) {
      // الطبيب أنقذ الهدف!
      wasSaved = true;
      console.log(`🩺 [${session.code}] Doctor saved the target!`);
    } else {
      const target = session.players.find(p => p.id === mafiaTarget);
      if (target && target.isAlive) {
        target.isAlive = false;
        killed = true;
        killedName = target.name;
        killedId = target.id;
      }
    }
  }

  session.lastKilled = killedId;
  session.lastKilledName = killedName;
  session.wasSaved = wasSaved;

  // 2. حفظ آخر حماية للطبيب (لمنع التكرار)
  session.nightActions.lastDoctorProtect = protect;

  const aliveCount = session.players.filter(p => p.isAlive).length;

  // لا نكشف سبب عدم القتل - نخفي الإنقاذ عن الجميع
  if (callbacks) {
    callbacks.onMorningResult(sessionId, { killed, killedName, killedId, wasSaved: false, aliveCount });
  }

  // 3. إرسال نتيجة المحقق
  if (check) {
    const detective = session.players.find(p => p.role === PlayerRole.DETECTIVE && p.isAlive);
    const target = session.players.find(p => p.id === check);

    if (detective && target && callbacks) {
      const result: DetectiveResult = {
        targetId: target.id,
        targetName: target.name,
        isMafia: target.role === PlayerRole.MAFIA,
      };
      callbacks.onDetectiveResult(detective.id, result);
      console.log(`🕵️ [${session.code}] Detective checked ${target.name} → ${result.isMafia ? 'MAFIA!' : 'innocent'}`);
    }
  }

  // 4. تحقق فوز
  const winCheck = checkWinCondition(session);
  if (winCheck) { endGame(sessionId, winCheck); return; }

  transitionToPhase(sessionId, GamePhase.MORNING);
}

// ============================================
// Chat System (DISCUSSION + REBUTTAL)
// ============================================

export function sendChatMessage(playerId: string, text: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };

  if (session.phase !== GamePhase.DISCUSSION && session.phase !== GamePhase.REBUTTAL) {
    return { success: false, error: 'ليس وقت النقاش' };
  }

  const player = session.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: 'غير موجود' };
  if (!player.isAlive) return { success: false, error: 'أنت مُقصى' };

  const currentCount = session.messageCount[playerId] || 0;
  if (currentCount >= MAX_MESSAGES_PER_PHASE) {
    return { success: false, error: 'أرسلت رسالتك بالفعل' };
  }

  const cleanText = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (cleanText.length === 0) return { success: false, error: 'الرسالة فارغة' };

  const message: ChatMessage = {
    id: generateId(),
    playerId: player.id,
    playerName: player.name,
    text: cleanText,
    phase: session.phase === GamePhase.DISCUSSION ? 'DISCUSSION' : 'REBUTTAL',
    timestamp: Date.now(),
  };

  session.messages.push(message);
  session.messageCount[playerId] = currentCount + 1;

  if (callbacks) {
    callbacks.onChatMessage(sessionId, message);
  }
  return { success: true };
}

// ============================================
// Voting System
// ============================================

export function castVote(playerId: string, targetId: string): { success: boolean; error?: string } {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return { success: false, error: 'لست في جلسة' };

  const session = sessions.get(sessionId);
  if (!session) return { success: false, error: 'جلسة غير موجودة' };
  if (session.phase !== GamePhase.VOTING) return { success: false, error: 'ليس وقت التصويت' };

  const voter = session.players.find(p => p.id === playerId);
  if (!voter) return { success: false, error: 'غير موجود' };
  if (!voter.isAlive) return { success: false, error: 'أنت مُقصى' };

  const target = session.players.find(p => p.id === targetId);
  if (!target) return { success: false, error: 'هدف غير موجود' };
  if (!target.isAlive) return { success: false, error: 'لا يمكن التصويت لمُقصى' };
  if (target.id === playerId) return { success: false, error: 'لا يمكن التصويت لنفسك' };

  session.votes[playerId] = targetId;

  const aliveVoters = session.players.filter(p => p.isAlive);
  const totalVotes = Object.keys(session.votes).length;

  if (callbacks) {
    callbacks.onVoteUpdate(sessionId, {
      voterId: voter.id, voterName: voter.name,
      totalVotes, totalEligible: aliveVoters.length,
    });
  }
  return { success: true };
}

function resolveVotes(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const voteEntries = Object.entries(session.votes);
  const countMap: Record<string, number> = {};
  voteEntries.forEach(([_, targetId]) => {
    countMap[targetId] = (countMap[targetId] || 0) + 1;
  });

  const voteCounts: VoteCount[] = Object.entries(countMap)
    .map(([playerId, count]) => ({
      playerId,
      playerName: session.players.find(p => p.id === playerId)?.name || '???',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const aliveCount = session.players.filter(p => p.isAlive).length;

  if (voteCounts.length === 0) {
    const result: VoteResultData = {
      eliminated: false, eliminatedId: null, eliminatedName: null,
      isTie: false, voteCounts: [], aliveCount,
    };
    session.voteResult = result;
    if (callbacks) callbacks.onVoteResult(sessionId, result);
    return;
  }

  const maxVotes = voteCounts[0].count;
  const topVoted = voteCounts.filter(v => v.count === maxVotes);

  if (topVoted.length > 1) {
    const result: VoteResultData = {
      eliminated: false, eliminatedId: null, eliminatedName: null,
      isTie: true, voteCounts, aliveCount,
    };
    session.voteResult = result;
    if (callbacks) callbacks.onVoteResult(sessionId, result);
    return;
  }

  const eliminated = session.players.find(p => p.id === topVoted[0].playerId);
  if (eliminated) {
    eliminated.isAlive = false;
    const newAliveCount = session.players.filter(p => p.isAlive).length;
    const result: VoteResultData = {
      eliminated: true, eliminatedId: eliminated.id, eliminatedName: eliminated.name,
      isTie: false, voteCounts, aliveCount: newAliveCount,
    };
    session.voteResult = result;
    if (callbacks) callbacks.onVoteResult(sessionId, result);
  }
}

// ============================================
// Win Condition
// ============================================

function checkWinCondition(session: GameSession): WinResult | null {
  const aliveMafia = session.players.filter(p => p.role === PlayerRole.MAFIA && p.isAlive).length;
  const aliveNonMafia = session.players.filter(p => p.role !== PlayerRole.MAFIA && p.isAlive).length;

  if (aliveMafia === 0) return WinResult.CITIZEN_WIN;
  if (aliveMafia >= aliveNonMafia) return WinResult.MAFIA_WIN;
  return null;
}

function endGame(sessionId: string, result: WinResult): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const timer = sessionTimers.get(sessionId);
  if (timer) { timer.stop(); sessionTimers.delete(sessionId); }

  session.isGameOver = true;
  session.winResult = result;
  session.phase = GamePhase.GAME_OVER;

  const winnerName = result === WinResult.MAFIA_WIN ? 'المافيا' : 'المدنيون';
  console.log(`\n🏁 [${session.code}] GAME OVER → ${winnerName}`);

  if (callbacks) {
    callbacks.onGameOver(sessionId, { winner: result, winnerName, players: session.players });
    callbacks.onSessionUpdated(sessionId, session);
  }
}

// ============================================
// State Machine
// ============================================

function transitionToPhase(sessionId: string, phase: GamePhase): void {
  const session = sessions.get(sessionId);
  if (!session || session.isGameOver) return;

  const duration = PHASE_DURATIONS[phase];
  const now = Date.now();

  session.phase = phase;
  session.phaseStartedAt = now;
  session.phaseEndsAt = now + (duration * 1000);

  if (phase === GamePhase.NIGHT) {
    // حفظ lastDoctorProtect قبل التصفير
    const lastProtect = session.nightActions.lastDoctorProtect;
    session.nightActions = emptyNightActions();
    session.nightActions.lastDoctorProtect = lastProtect;
    session.voteResult = null;
    session.wasSaved = false;
    session.mafiaMessages = [];
    session.mafiaMsgCount = {};
  }
  if (phase === GamePhase.DISCUSSION) {
    session.messages = [];
    session.messageCount = {};
  }
  if (phase === GamePhase.REBUTTAL) {
    session.messageCount = {};
  }
  if (phase === GamePhase.VOTING) {
    session.votes = {};
    session.voteResult = null;
  }

  const info = PHASE_INFO[phase];
  console.log(`${info.icon} [${session.code}] → ${info.name} (${duration}s) R${session.round}`);

  if (callbacks) {
    callbacks.onPhaseChange(sessionId, { phase, round: session.round, duration, info });
    callbacks.onSessionUpdated(sessionId, session);
  }

  startPhaseTimer(sessionId, phase, duration);
}

function startPhaseTimer(sessionId: string, phase: GamePhase, duration: number): void {
  const existingTimer = sessionTimers.get(sessionId);
  if (existingTimer) existingTimer.stop();

  const timer = new PhaseTimer(
    (remaining, total) => {
      if (callbacks) callbacks.onTimerTick(sessionId, { remaining, total, phase });
    },
    () => { onPhaseComplete(sessionId); }
  );

  sessionTimers.set(sessionId, timer);
  timer.start(duration);
}

function onPhaseComplete(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session || session.isGameOver) return;

  switch (session.phase) {
    case GamePhase.NIGHT:
      executeNightKill(sessionId);
      break;
    case GamePhase.MORNING:
      transitionToPhase(sessionId, GamePhase.DISCUSSION);
      break;
    case GamePhase.DISCUSSION:
      transitionToPhase(sessionId, GamePhase.REBUTTAL);
      break;
    case GamePhase.REBUTTAL:
      transitionToPhase(sessionId, GamePhase.VOTING);
      break;
    case GamePhase.VOTING:
      resolveVotes(sessionId);
      {
        const winCheck = checkWinCondition(session);
        if (winCheck) {
          endGame(sessionId, winCheck);
        } else {
          transitionToPhase(sessionId, GamePhase.RESULT);
        }
      }
      break;
    case GamePhase.RESULT:
      session.round++;
      transitionToPhase(sessionId, GamePhase.NIGHT);
      break;
  }
}

// ============================================
// Public Helpers
// ============================================

export function getSessionByPlayer(playerId: string): GameSession | null {
  const sessionId = playerToSession.get(playerId);
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

export function getSessionIdByPlayer(playerId: string): string | null {
  return playerToSession.get(playerId) || null;
}

export function getAliveMafiaIds(sessionId: string): string[] {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.players.filter(p => p.role === PlayerRole.MAFIA && p.isAlive).map(p => p.id);
}

export function getActiveSessions(): number {
  return sessions.size;
}
