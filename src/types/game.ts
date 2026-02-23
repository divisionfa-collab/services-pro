// ============================================
// Doubt Game - Core Types
// Sprint 6: Advanced Night System
// ============================================

/**
 * حالات اللعبة
 * NIGHT → MORNING → DISCUSSION → REBUTTAL → VOTING → RESULT → NIGHT...
 */
export enum GamePhase {
  LOBBY      = 'LOBBY',
  NIGHT      = 'NIGHT',
  MORNING    = 'MORNING',
  DISCUSSION = 'DISCUSSION',
  REBUTTAL   = 'REBUTTAL',
  VOTING     = 'VOTING',
  RESULT     = 'RESULT',
  GAME_OVER  = 'GAME_OVER',
}

export enum PlayerRole {
  MAFIA     = 'MAFIA',
  CITIZEN   = 'CITIZEN',
  DOCTOR    = 'DOCTOR',
  DETECTIVE = 'DETECTIVE',
}

export const PHASE_ORDER: GamePhase[] = [
  GamePhase.NIGHT,
  GamePhase.MORNING,
  GamePhase.DISCUSSION,
  GamePhase.REBUTTAL,
  GamePhase.VOTING,
  GamePhase.RESULT,
];

export const PHASE_DURATIONS: Record<GamePhase, number> = {
  [GamePhase.LOBBY]:      0,
  [GamePhase.NIGHT]:      20,   // زيادة 5 ثواني (3 أدوار تختار)
  [GamePhase.MORNING]:    6,
  [GamePhase.DISCUSSION]: 30,
  [GamePhase.REBUTTAL]:   20,
  [GamePhase.VOTING]:     15,
  [GamePhase.RESULT]:     6,
  [GamePhase.GAME_OVER]:  0,
};

export const MAX_MESSAGES_PER_PHASE = 1;
export const MAX_MESSAGE_LENGTH = 110;

/** حد رسائل قناة المافيا السرية */
export const MAX_MAFIA_CHAT_LENGTH = 60;
export const MAX_MAFIA_MESSAGES = 2;

export const PHASE_INFO: Record<GamePhase, { name: string; description: string; icon: string }> = {
  [GamePhase.LOBBY]:      { name: 'الانتظار',    description: 'في انتظار اللاعبين...',           icon: '🏠' },
  [GamePhase.NIGHT]:      { name: 'الليل',       description: 'المدينة نائمة...',                icon: '🌙' },
  [GamePhase.MORNING]:    { name: 'الصباح',      description: 'المدينة تستيقظ...',                icon: '🌅' },
  [GamePhase.DISCUSSION]: { name: 'النقاش',      description: 'اطرح موقفك! (رسالة واحدة)',        icon: '💬' },
  [GamePhase.REBUTTAL]:   { name: 'الرد',        description: 'ردّ على ما قيل! (رسالة واحدة)',    icon: '🔄' },
  [GamePhase.VOTING]:     { name: 'التصويت',     description: 'صوّتوا لطرد المشبوه!',             icon: '🗳️' },
  [GamePhase.RESULT]:     { name: 'النتيجة',     description: 'نتيجة التصويت...',                 icon: '📊' },
  [GamePhase.GAME_OVER]:  { name: 'انتهت اللعبة', description: '',                                icon: '🏁' },
};

/**
 * توزيع الأدوار حسب عدد اللاعبين
 * 2-3: 1 مافيا + مدنيين
 * 4-5: 1 مافيا + 1 محقق + مدنيين
 * 6+:  2 مافيا + 1 محقق + 1 طبيب + مدنيين
 */
export function getRoleDistribution(playerCount: number): PlayerRole[] {
  if (playerCount <= 3) {
    return [PlayerRole.MAFIA, ...Array(playerCount - 1).fill(PlayerRole.CITIZEN)];
  }
  if (playerCount <= 5) {
    return [
      PlayerRole.MAFIA,
      PlayerRole.DETECTIVE,
      ...Array(playerCount - 2).fill(PlayerRole.CITIZEN),
    ];
  }
  // 6+
  return [
    PlayerRole.MAFIA, PlayerRole.MAFIA,
    PlayerRole.DETECTIVE,
    PlayerRole.DOCTOR,
    ...Array(playerCount - 4).fill(PlayerRole.CITIZEN),
  ];
}

// ============================================
// Player & Session
// ============================================

export interface Player {
  id: string;
  name: string;
  role: PlayerRole | null;
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export enum WinResult {
  MAFIA_WIN   = 'MAFIA_WIN',
  CITIZEN_WIN = 'CITIZEN_WIN',
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  phase: 'DISCUSSION' | 'REBUTTAL';
  timestamp: number;
}

/** رسالة القناة السرية للمافيا */
export interface MafiaChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

/** أفعال الليل */
export interface NightActions {
  mafiaTarget: string | null;       // من تريد المافيا قتله
  doctorProtect: string | null;     // من يحمي الطبيب
  detectiveCheck: string | null;    // من يفحص المحقق
  lastDoctorProtect: string | null; // من حماه الطبيب الليلة الماضية (منع التكرار)
}

/** نتيجة فحص المحقق */
export interface DetectiveResult {
  targetId: string;
  targetName: string;
  isMafia: boolean;
}

export interface GameSession {
  id: string;
  code: string;
  players: Player[];
  phase: GamePhase;
  round: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  isStarted: boolean;
  isGameOver: boolean;
  winResult: WinResult | null;
  // Night Actions (Sprint 6)
  nightActions: NightActions;
  lastKilled: string | null;
  lastKilledName: string | null;
  wasSaved: boolean;               // هل تم إنقاذ الهدف؟
  // Mafia Chat (Sprint 6)
  mafiaMessages: MafiaChatMessage[];
  mafiaMsgCount: Record<string, number>;
  // Voting
  votes: Record<string, string>;
  voteResult: VoteResultData | null;
  // Discussion
  messages: ChatMessage[];
  messageCount: Record<string, number>;
  createdAt: number;
}

// ============================================
// Socket Events
// ============================================

export interface ClientToServerEvents {
  'session:create': (playerName: string, callback: (response: SessionResponse) => void) => void;
  'session:join': (code: string, playerName: string, callback: (response: SessionResponse) => void) => void;
  'game:start': (callback: (response: BaseResponse) => void) => void;
  'night:select_target': (targetId: string, callback: (response: BaseResponse) => void) => void;
  'night:doctor_protect': (targetId: string, callback: (response: BaseResponse) => void) => void;
  'night:detective_check': (targetId: string, callback: (response: BaseResponse) => void) => void;
  'mafia:chat': (text: string, callback: (response: BaseResponse) => void) => void;
  'vote:cast': (targetId: string, callback: (response: BaseResponse) => void) => void;
  'chat:send': (text: string, callback: (response: BaseResponse) => void) => void;
}

export interface ServerToClientEvents {
  'session:updated': (session: GameSession) => void;
  'phase:changed': (data: PhaseChangeData) => void;
  'timer:tick': (data: TimerData) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'role:assigned': (data: RoleAssignment) => void;
  'night:target_selected': (data: NightTargetData) => void;
  'night:doctor_selected': (data: { targetName: string }) => void;
  'night:detective_selected': (data: { targetName: string }) => void;
  'morning:kill_result': (data: MorningResult) => void;
  'detective:result': (data: DetectiveResult) => void;
  'mafia:message': (message: MafiaChatMessage) => void;
  'vote:update': (data: VoteUpdateData) => void;
  'vote:result': (data: VoteResultData) => void;
  'chat:message': (message: ChatMessage) => void;
  'game:over': (data: GameOverData) => void;
  'error': (message: string) => void;
}

// ============================================
// Data Types
// ============================================

export interface RoleAssignment {
  role: PlayerRole;
  teammates: string[];
}

export interface NightTargetData {
  targetId: string;
  targetName: string;
  selectedBy: string;
}

export interface MorningResult {
  killed: boolean;
  killedName: string | null;
  killedId: string | null;
  wasSaved: boolean;
  aliveCount: number;
}

export interface VoteUpdateData {
  voterId: string;
  voterName: string;
  totalVotes: number;
  totalEligible: number;
}

export interface VoteResultData {
  eliminated: boolean;
  eliminatedId: string | null;
  eliminatedName: string | null;
  isTie: boolean;
  voteCounts: VoteCount[];
  aliveCount: number;
}

export interface VoteCount {
  playerId: string;
  playerName: string;
  count: number;
}

export interface GameOverData {
  winner: WinResult;
  winnerName: string;
  players: Player[];
}

export interface PhaseChangeData {
  phase: GamePhase;
  round: number;
  duration: number;
  info: { name: string; description: string; icon: string };
}

export interface TimerData {
  remaining: number;
  total: number;
  phase: GamePhase;
}

export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface SessionResponse extends BaseResponse {
  session?: GameSession;
  playerId?: string;
}
