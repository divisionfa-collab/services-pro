// ============================================
// Doubt Game - Socket.IO Server
// Sprint 6: Advanced Night System
// ============================================

import { Server, Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  GameSession,
} from '../types/game';
import {
  setCallbacks,
  createSession,
  joinSession,
  leaveSession,
  startGame,
  selectNightTarget,
  doctorProtect,
  detectiveCheck,
  sendMafiaChat,
  castVote,
  sendChatMessage,
  getAliveMafiaIds,
  getActiveSessions,
} from './gameEngine';

export function setupSocketServer(io: Server<ClientToServerEvents, ServerToClientEvents>): void {

  setCallbacks({
    onPhaseChange: (sessionId, data) => {
      io.to(sessionId).emit('phase:changed', data);
    },
    onTimerTick: (sessionId, data) => {
      io.to(sessionId).emit('timer:tick', data);
    },
    onSessionUpdated: (sessionId, session) => {
      io.to(sessionId).emit('session:updated', sanitizeSession(session));
    },
    onRoleAssigned: (playerId, data) => {
      io.to(playerId).emit('role:assigned', data);
    },
    onNightTargetSelected: (sessionId, data, mafiaOnly) => {
      if (mafiaOnly) {
        const mafiaIds = getAliveMafiaIds(sessionId);
        mafiaIds.forEach(id => io.to(id).emit('night:target_selected', data));
      } else {
        io.to(sessionId).emit('night:target_selected', data);
      }
    },
    onDoctorSelected: (playerId, data) => {
      // إشعار خاص للطبيب فقط
      io.to(playerId).emit('night:doctor_selected', data);
    },
    onDetectiveSelected: (playerId, data) => {
      // إشعار خاص للمحقق فقط
      io.to(playerId).emit('night:detective_selected', data);
    },
    onMorningResult: (sessionId, data) => {
      io.to(sessionId).emit('morning:kill_result', data);
    },
    onDetectiveResult: (playerId, data) => {
      // نتيجة الفحص تُرسل للمحقق فقط
      io.to(playerId).emit('detective:result', data);
    },
    onMafiaMessage: (sessionId, message) => {
      // رسائل المافيا ترسل فقط لأعضاء المافيا
      const mafiaIds = getAliveMafiaIds(sessionId);
      mafiaIds.forEach(id => io.to(id).emit('mafia:message', message));
    },
    onVoteUpdate: (sessionId, data) => {
      io.to(sessionId).emit('vote:update', data);
    },
    onVoteResult: (sessionId, data) => {
      io.to(sessionId).emit('vote:result', data);
    },
    onChatMessage: (sessionId, message) => {
      io.to(sessionId).emit('chat:message', message);
    },
    onGameOver: (sessionId, data) => {
      io.to(sessionId).emit('game:over', data);
    },
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on('session:create', (playerName, callback) => {
      try {
        const { session, player } = createSession(playerName, socket.id);
        socket.join(session.id);
        callback({ success: true, session: sanitizeSession(session), playerId: player.id });
      } catch (err) {
        callback({ success: false, error: 'خطأ في إنشاء الجلسة' });
      }
    });

    socket.on('session:join', (code, playerName, callback) => {
      try {
        const result = joinSession(code, playerName, socket.id);
        if ('error' in result) { callback({ success: false, error: result.error }); return; }
        const { session, player } = result;
        socket.join(session.id);
        socket.to(session.id).emit('player:joined', player);
        io.to(session.id).emit('session:updated', sanitizeSession(session));
        callback({ success: true, session: sanitizeSession(session), playerId: player.id });
      } catch (err) {
        callback({ success: false, error: 'خطأ في الانضمام' });
      }
    });

    socket.on('game:start', (callback) => {
      try { callback(startGame(socket.id)); }
      catch (err) { callback({ success: false, error: 'خطأ في بدء اللعبة' }); }
    });

    // Night actions
    socket.on('night:select_target', (targetId, callback) => {
      try { callback(selectNightTarget(socket.id, targetId)); }
      catch (err) { callback({ success: false, error: 'خطأ' }); }
    });

    socket.on('night:doctor_protect', (targetId, callback) => {
      try { callback(doctorProtect(socket.id, targetId)); }
      catch (err) { callback({ success: false, error: 'خطأ' }); }
    });

    socket.on('night:detective_check', (targetId, callback) => {
      try { callback(detectiveCheck(socket.id, targetId)); }
      catch (err) { callback({ success: false, error: 'خطأ' }); }
    });

    socket.on('mafia:chat', (text, callback) => {
      try { callback(sendMafiaChat(socket.id, text)); }
      catch (err) { callback({ success: false, error: 'خطأ' }); }
    });

    socket.on('vote:cast', (targetId, callback) => {
      try { callback(castVote(socket.id, targetId)); }
      catch (err) { callback({ success: false, error: 'خطأ' }); }
    });

    socket.on('chat:send', (text, callback) => {
      try { callback(sendChatMessage(socket.id, text)); }
      catch (err) { callback({ success: false, error: 'خطأ' }); }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${socket.id}`);
      const result = leaveSession(socket.id);
      if (result) {
        const { sessionId, session } = result;
        if (session) {
          io.to(sessionId).emit('player:left', socket.id);
          io.to(sessionId).emit('session:updated', sanitizeSession(session));
        }
      }
    });
  });
}

function sanitizeSession(session: GameSession): GameSession {
  return {
    ...session,
    nightActions: {
      mafiaTarget: null,
      doctorProtect: null,
      detectiveCheck: null,
      lastDoctorProtect: null,
    },
    mafiaMessages: [],
    mafiaMsgCount: {},
    votes: {},
    players: session.players.map(p => ({
      ...p,
      role: session.isGameOver ? p.role : null,
    })),
  };
}
