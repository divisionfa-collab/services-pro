'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSocket } from '@/lib/useSocket';
import { GamePhase, PlayerRole, PHASE_INFO, MAX_MESSAGES_PER_PHASE, MAX_MESSAGE_LENGTH, MAX_MAFIA_CHAT_LENGTH, MAX_MAFIA_MESSAGES } from '@/types/game';

function LobbyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    isConnected, session, playerId, myRole, phaseData, timerData,
    nightTarget, morningResult, voteUpdate, voteResult, messages,
    mafiaMessages, detectiveResult, detectiveHistory, doctorConfirm, detectiveConfirm,
    gameOver, error,
    createSession, joinSession, startGame, selectNightTarget,
    doctorProtect, detectiveCheck, sendMafiaChat,
    castVote, sendMessage,
  } = useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [mafiaInput, setMafiaInput] = useState('');
  const [mySentCount, setMySentCount] = useState(0);
  const [mafiaSentCount, setMafiaSentCount] = useState(0);
  const [showDetectiveLog, setShowDetectiveLog] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mafiaChatEndRef = useRef<HTMLDivElement>(null);

  const playerName = searchParams.get('name') || '';
  const action = searchParams.get('action') || '';
  const code = searchParams.get('code') || '';

  useEffect(() => {
    if (!isConnected || hasJoined || !playerName) return;
    const doAction = async () => {
      setIsLoading(true);
      let success = false;
      if (action === 'create') success = await createSession(playerName);
      else if (action === 'join' && code) success = await joinSession(code, playerName);
      if (!success) setTimeout(() => router.push('/'), 2000);
      else setHasJoined(true);
      setIsLoading(false);
    };
    doAction();
  }, [isConnected, hasJoined, playerName, action, code]);

  useEffect(() => {
    if (phaseData?.phase === 'NIGHT') { setSelectedTarget(null); setMyVote(null); setMySentCount(0); setMafiaSentCount(0); setMafiaInput(''); }
    if (phaseData?.phase === 'VOTING') { setMyVote(null); }
    if (phaseData?.phase === 'DISCUSSION') { setMySentCount(0); setChatInput(''); }
    if (phaseData?.phase === 'REBUTTAL') { setMySentCount(0); setChatInput(''); }
  }, [phaseData?.phase, session?.round]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { mafiaChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mafiaMessages]);

  const isHost = session?.players.find(p => p.id === playerId)?.isHost || false;
  const isMafia = myRole?.role === PlayerRole.MAFIA;
  const isDoctor = myRole?.role === PlayerRole.DOCTOR;
  const isDetective = myRole?.role === PlayerRole.DETECTIVE;
  const amIAlive = session?.players.find(p => p.id === playerId)?.isAlive ?? true;
  const phaseClass = session?.phase ? `phase-${session.phase.toLowerCase().replace('_', '-')}` : 'phase-lobby';
  const currentPhaseInfo = phaseData?.info || (session?.phase ? PHASE_INFO[session.phase] : null);
  const timerPercent = timerData ? (timerData.remaining / timerData.total) * 100 : 100;
  const alivePlayers = session?.players.filter(p => p.isAlive) || [];
  const deadPlayers = session?.players.filter(p => !p.isAlive) || [];
  const isChatPhase = session?.phase === GamePhase.DISCUSSION || session?.phase === GamePhase.REBUTTAL;
  const canSendMessage = amIAlive && mySentCount < MAX_MESSAGES_PER_PHASE && isChatPhase;

  const roleIcons: Record<string, string> = {
    [PlayerRole.MAFIA]: '🔪', [PlayerRole.CITIZEN]: '🏘️',
    [PlayerRole.DOCTOR]: '🩺', [PlayerRole.DETECTIVE]: '🕵️',
  };
  const roleNames: Record<string, string> = {
    [PlayerRole.MAFIA]: 'مافيا', [PlayerRole.CITIZEN]: 'مدني',
    [PlayerRole.DOCTOR]: 'طبيب', [PlayerRole.DETECTIVE]: 'محقق',
  };

  const handleSelectTarget = async (targetId: string) => {
    if (!amIAlive || session?.phase !== GamePhase.NIGHT) return;
    setSelectedTarget(targetId);
    if (isMafia) await selectNightTarget(targetId);
    else if (isDoctor) await doctorProtect(targetId);
    else if (isDetective) await detectiveCheck(targetId);
  };

  const handleVote = async (targetId: string) => {
    if (!amIAlive || session?.phase !== GamePhase.VOTING) return;
    setMyVote(targetId);
    await castVote(targetId);
  };

  const handleSendMessage = async () => {
    if (!canSendMessage || !chatInput.trim()) return;
    const success = await sendMessage(chatInput.trim());
    if (success) { setChatInput(''); setMySentCount(prev => prev + 1); }
  };

  const handleSendMafiaChat = async () => {
    if (!isMafia || mafiaSentCount >= MAX_MAFIA_MESSAGES || !mafiaInput.trim()) return;
    const success = await sendMafiaChat(mafiaInput.trim());
    if (success) { setMafiaInput(''); setMafiaSentCount(prev => prev + 1); }
  };

  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handler(); }
  };

  const TimerCircle = ({ compact = false }: { compact?: boolean }) => (
    timerData && timerData.total > 0 ? (
      <div className={compact ? 'mb-2' : 'mb-5'}>
        <div className={`relative mx-auto ${compact ? 'w-14 h-14' : 'w-24 h-24'}`}>
          <svg className={`transform -rotate-90 ${compact ? 'w-14 h-14' : 'w-24 h-24'}`} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
            <circle cx="50" cy="50" r="45"
              stroke={timerData.remaining <= 3 ? '#e74c3c' : '#f39c12'}
              strokeWidth="6" fill="none" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - timerPercent / 100)}`}
              className="transition-all duration-1000 ease-linear" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold ${compact ? 'text-base' : 'text-2xl'} ${timerData.remaining <= 3 ? 'text-doubt-accent animate-pulse' : 'text-doubt-gold'}`}>
              {timerData.remaining}
            </span>
          </div>
        </div>
      </div>
    ) : null
  );

  const getNightTargets = () => {
    if (!amIAlive) return [];
    if (isMafia) return alivePlayers.filter(p => p.id !== playerId && !myRole?.teammates.includes(p.name));
    if (isDoctor) return alivePlayers;
    if (isDetective) return alivePlayers.filter(p => p.id !== playerId);
    return [];
  };

  const getNightTitle = () => {
    if (isMafia) return '🔪 اختر ضحية الليلة';
    if (isDoctor) return '🩺 اختر من تحمي';
    if (isDetective) return '🕵️ اختر من تفحص';
    return '';
  };

  const getNightConfirm = () => {
    if (isMafia && nightTarget) return `🎯 ${nightTarget.targetName}`;
    if (isDoctor && doctorConfirm) return `🛡️ ${doctorConfirm}`;
    if (isDetective && detectiveConfirm) return `🔍 ${detectiveConfirm}`;
    return null;
  };

  // LOADING
  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center phase-lobby">
        {error ? (
          <div className="animate-fade-in text-center">
            <p className="text-doubt-accent text-xl mb-4">❌ {error}</p>
            <p className="text-doubt-muted">جاري العودة...</p>
          </div>
        ) : (
          <p className="text-2xl text-doubt-muted animate-pulse">جاري الاتصال...</p>
        )}
      </div>
    );
  }

  // GAME OVER
  if (gameOver || session.isGameOver) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 phase-transition phase-result">
        <div className="text-center animate-fade-in max-w-md w-full">
          <div className="text-8xl mb-6">🏁</div>
          <h1 className="text-4xl font-bold mb-3">انتهت اللعبة!</h1>
          <div className={`text-3xl font-bold mb-8 ${
            gameOver?.winner === 'MAFIA_WIN' ? 'text-doubt-accent' : 'text-green-400'
          }`}>
            {gameOver?.winnerName || '???'} فازوا! 🎉
          </div>
          <div className="space-y-2 mb-8">
            <h3 className="text-doubt-muted text-sm mb-3">كشف الأدوار</h3>
            {(gameOver?.players || session.players).map((p) => (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                p.isAlive ? 'bg-white/10' : 'bg-white/5 opacity-60'
              }`}>
                <span className="text-2xl">{roleIcons[p.role || ''] || '👤'}</span>
                <span className="flex-1">{p.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  p.role === 'MAFIA' ? 'bg-doubt-accent/20 text-doubt-accent' :
                  p.role === 'DOCTOR' ? 'bg-blue-500/20 text-blue-400' :
                  p.role === 'DETECTIVE' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-green-500/20 text-green-400'
                }`}>{roleNames[p.role || ''] || '?'}</span>
                {!p.isAlive && <span className="text-xs text-doubt-muted">💀</span>}
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/')}
            className="w-full py-4 bg-doubt-accent hover:bg-doubt-accent/80 rounded-xl text-xl font-bold transition-all">
            🏠 العودة للقائمة
          </button>
        </div>
      </div>
    );
  }

  // GAME
  if (session.isStarted) {
    return (
      <div className={`min-h-screen flex flex-col items-center p-4 phase-transition ${phaseClass}`}
           style={{ justifyContent: (isChatPhase || session.phase === GamePhase.NIGHT) ? 'flex-start' : 'center',
                    paddingTop: (isChatPhase || session.phase === GamePhase.NIGHT) ? '0.5rem' : undefined }}>

        {/* Detective Result Notification */}
        {detectiveResult && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className={`px-6 py-3 rounded-2xl border ${
              detectiveResult.isMafia
                ? 'bg-red-900/90 border-red-500/50 text-red-200'
                : 'bg-purple-900/90 border-purple-500/50 text-purple-200'
            }`}>
              <p className="text-sm font-bold text-center">
                🕵️ {detectiveResult.targetName}: {detectiveResult.isMafia ? '⚠️ عضو عصابة!' : '✅ ليس عضو عصابة'}
              </p>
            </div>
          </div>
        )}

        {/* Role Badge */}
        {myRole && (
          <div className={`fixed top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold z-50 ${
            isMafia ? 'bg-doubt-accent/20 text-doubt-accent border border-doubt-accent/30' :
            isDoctor ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            isDetective ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
            'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}>
            {roleIcons[myRole.role]} {roleNames[myRole.role]}
            {isMafia && myRole.teammates.length > 0 && (
              <span className="opacity-70 mr-1"> +{myRole.teammates.join(',')}</span>
            )}
          </div>
        )}

        {/* Detective Log */}
        {isDetective && detectiveHistory.length > 0 && (
          <button onClick={() => setShowDetectiveLog(!showDetectiveLog)}
            className="fixed top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold z-50
                       bg-purple-500/20 text-purple-400 border border-purple-500/30">
            📋 ({detectiveHistory.length})
          </button>
        )}

        {showDetectiveLog && (
          <div className="fixed top-14 right-4 z-50 bg-black/95 border border-purple-500/30 rounded-xl p-3 w-56 animate-fade-in">
            <h4 className="text-purple-400 text-xs font-bold mb-2">🕵️ سجل الفحوصات</h4>
            {detectiveHistory.map((r, i) => (
              <div key={i} className={`text-xs p-2 rounded-lg mb-1 ${
                r.isMafia ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'
              }`}>
                {r.targetName}: {r.isMafia ? '⚠️ مافيا' : '✅ بريء'}
              </div>
            ))}
          </div>
        )}

        {/* Dead Badge */}
        {!amIAlive && (
          <div className="fixed top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold z-50
                          bg-white/10 text-doubt-muted border border-white/10">
            💀 متفرج
          </div>
        )}

        {/* Phase Info */}
        <div className={`text-center animate-fade-in ${(isChatPhase || session.phase === GamePhase.NIGHT) ? 'pt-6 mb-2' : 'mb-4'}`}>
          {!isChatPhase && session.phase !== GamePhase.NIGHT && <div className="text-6xl mb-3">{currentPhaseInfo?.icon}</div>}
          <h1 className={`font-bold mb-1 ${(isChatPhase || session.phase === GamePhase.NIGHT) ? 'text-xl' : 'text-3xl'}`}>
            {currentPhaseInfo?.icon} {currentPhaseInfo?.name}
          </h1>
          <p className="text-doubt-muted text-xs">{currentPhaseInfo?.description}</p>
          <p className="text-doubt-gold text-xs mt-0.5">الجولة {session.round}</p>
        </div>

        <TimerCircle compact={isChatPhase || session.phase === GamePhase.NIGHT} />

        {/* NIGHT - Active roles */}
        {session.phase === GamePhase.NIGHT && amIAlive && (isMafia || isDoctor || isDetective) && (
          <div className="w-full max-w-sm animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
            <div className="flex-1 overflow-y-auto">
              <h3 className={`text-center text-sm font-bold mb-3 ${
                isMafia ? 'text-doubt-accent' : isDoctor ? 'text-blue-400' : 'text-purple-400'
              }`}>{getNightTitle()}</h3>

              <div className="space-y-2 mb-3">
                {getNightTargets().map((p) => {
                  const isSelected = selectedTarget === p.id ||
                    (isMafia && nightTarget?.targetId === p.id) ||
                    (isDoctor && doctorConfirm === p.name) ||
                    (isDetective && detectiveConfirm === p.name);
                  return (
                    <button key={p.id} onClick={() => handleSelectTarget(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                        isSelected
                          ? isMafia ? 'bg-doubt-accent/30 border-2 border-doubt-accent'
                            : isDoctor ? 'bg-blue-500/30 border-2 border-blue-500'
                            : 'bg-purple-500/30 border-2 border-purple-500'
                          : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                      }`}>
                      <span className="text-xl">{isSelected ? (isMafia ? '🎯' : isDoctor ? '🛡️' : '🔍') : '👤'}</span>
                      <span className="flex-1 text-right">{p.name}</span>
                    </button>
                  );
                })}
              </div>

              {getNightConfirm() && (
                <div className="text-center py-2 bg-white/5 rounded-xl mb-3">
                  <span className="text-xs text-doubt-muted">{getNightConfirm()}</span>
                </div>
              )}
            </div>

            {/* Mafia Secret Chat */}
            {isMafia && (
              <div className="border-t border-doubt-accent/20 pt-3 mt-3">
                <p className="text-doubt-accent text-xs font-bold mb-2 text-center">🔴 قناة سرية</p>
                <div className="max-h-24 overflow-y-auto space-y-1 mb-2 scrollbar-thin">
                  {mafiaMessages.map((msg) => (
                    <div key={msg.id} className={`text-xs px-2 py-1 rounded-lg ${
                      msg.playerId === playerId ? 'bg-doubt-accent/15 text-doubt-accent' : 'bg-white/5'
                    }`}>
                      <span className="font-bold">{msg.playerName}: </span>{msg.text}
                    </div>
                  ))}
                  <div ref={mafiaChatEndRef} />
                </div>
                <div className="flex gap-2">
                  <input type="text" value={mafiaInput}
                    onChange={(e) => setMafiaInput(e.target.value.slice(0, MAX_MAFIA_CHAT_LENGTH))}
                    onKeyDown={(e) => handleKeyDown(e, handleSendMafiaChat)}
                    placeholder={mafiaSentCount >= MAX_MAFIA_MESSAGES ? 'انتهت رسائلك' : 'رسالة سرية...'}
                    disabled={mafiaSentCount >= MAX_MAFIA_MESSAGES}
                    className="flex-1 bg-doubt-accent/5 border border-doubt-accent/20 rounded-lg px-3 py-2 text-xs
                               placeholder:text-doubt-muted/50 focus:outline-none focus:border-doubt-accent/40
                               disabled:opacity-30" dir="rtl" />
                  <button onClick={handleSendMafiaChat}
                    disabled={mafiaSentCount >= MAX_MAFIA_MESSAGES || !mafiaInput.trim()}
                    className="px-3 py-2 bg-doubt-accent/20 text-doubt-accent rounded-lg text-xs font-bold
                               disabled:opacity-30">
                    {mafiaSentCount}/{MAX_MAFIA_MESSAGES}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NIGHT - Citizen sleeping */}
        {session.phase === GamePhase.NIGHT && !isMafia && !isDoctor && !isDetective && amIAlive && (
          <div className="text-center mb-6 animate-fade-in">
            <p className="text-doubt-muted text-lg">😴 أنت نائم...</p>
          </div>
        )}

        {/* MORNING */}
        {session.phase === GamePhase.MORNING && (
          <div className="text-center mb-6 animate-fade-in">
            {morningResult?.killed ? (
              <div>
                <div className="text-5xl mb-3">💀</div>
                <p className="text-2xl font-bold text-doubt-accent mb-2">تم القضاء على {morningResult.killedName}!</p>
                <p className="text-doubt-muted text-sm">الأحياء: {morningResult.aliveCount}</p>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-3">😌</div>
                <p className="text-2xl font-bold text-green-400">لم يُقتل أحد الليلة</p>
              </div>
            )}
          </div>
        )}

        {/* DISCUSSION + REBUTTAL */}
        {isChatPhase && (
          <div className="w-full max-w-md flex flex-col animate-fade-in" style={{ height: 'calc(100vh - 180px)' }}>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 px-1 scrollbar-thin">
              {messages.length === 0 && (
                <div className="text-center py-8"><p className="text-doubt-muted/50 text-sm">💬 ابدأ النقاش...</p></div>
              )}

              {session.phase === GamePhase.REBUTTAL && messages.some(m => m.phase === 'DISCUSSION') && (
                <>
                  {messages.filter(m => m.phase === 'DISCUSSION').map((msg) => {
                    const isMe = msg.playerId === playerId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                          isMe ? 'bg-doubt-gold/20 text-doubt-gold rounded-tr-sm' : 'bg-white/10 rounded-tl-sm'
                        }`}>
                          {!isMe && <p className="text-xs text-doubt-muted mb-1 font-bold">{msg.playerName}</p>}
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-xs text-doubt-muted/50">🔄 مرحلة الرد</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>
                  {messages.filter(m => m.phase === 'REBUTTAL').map((msg) => {
                    const isMe = msg.playerId === playerId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                          isMe ? 'bg-blue-500/20 text-blue-300 rounded-tr-sm' : 'bg-white/8 rounded-tl-sm'
                        }`}>
                          {!isMe && <p className="text-xs text-doubt-muted mb-1 font-bold">{msg.playerName}</p>}
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {session.phase === GamePhase.DISCUSSION && messages.map((msg) => {
                const isMe = msg.playerId === playerId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                      isMe ? 'bg-doubt-gold/20 text-doubt-gold rounded-tr-sm' : 'bg-white/10 rounded-tl-sm'
                    }`}>
                      {!isMe && <p className="text-xs text-doubt-muted mb-1 font-bold">{msg.playerName}</p>}
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {amIAlive ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <input type="text" value={chatInput}
                    onChange={(e) => setChatInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    onKeyDown={(e) => handleKeyDown(e, handleSendMessage)}
                    placeholder={canSendMessage
                      ? (session.phase === GamePhase.DISCUSSION ? 'اطرح موقفك...' : 'ردّ على ما قيل...')
                      : 'أرسلت رسالتك ✓'}
                    disabled={!canSendMessage}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                               placeholder:text-doubt-muted/50 focus:outline-none focus:border-doubt-gold/30
                               disabled:opacity-40" dir="rtl" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-doubt-muted/50">
                    {chatInput.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
                <button onClick={handleSendMessage} disabled={!canSendMessage || !chatInput.trim()}
                  className={`px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-30 ${
                    session.phase === GamePhase.DISCUSSION ? 'bg-doubt-gold/20 text-doubt-gold' : 'bg-blue-500/20 text-blue-300'
                  }`}>إرسال</button>
              </div>
            ) : (
              <div className="text-center py-2"><p className="text-doubt-muted text-xs">👻 أنت متفرج</p></div>
            )}
          </div>
        )}

        {/* VOTING */}
        {session.phase === GamePhase.VOTING && amIAlive && (
          <div className="w-full max-w-sm mb-6 animate-fade-in">
            <h3 className="text-doubt-gold text-center text-sm font-bold mb-3">🗳️ صوّت لطرد المشبوه</h3>
            {voteUpdate && (
              <div className="text-center mb-3">
                <span className="text-xs text-doubt-muted">صوّت {voteUpdate.totalVotes} من {voteUpdate.totalEligible}</span>
                <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-doubt-gold rounded-full transition-all duration-500"
                    style={{ width: `${(voteUpdate.totalVotes / voteUpdate.totalEligible) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {alivePlayers.filter(p => p.id !== playerId).map((p) => {
                const isVoted = myVote === p.id;
                return (
                  <button key={p.id} onClick={() => handleVote(p.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      isVoted ? 'bg-doubt-gold/30 border-2 border-doubt-gold' : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                    }`}>
                    <span className="text-xl">{isVoted ? '✋' : '👤'}</span>
                    <span className="flex-1 text-right">{p.name}</span>
                    {isVoted && <span className="text-xs text-doubt-gold bg-doubt-gold/10 px-2 py-1 rounded-full">صوتك</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {session.phase === GamePhase.VOTING && !amIAlive && (
          <div className="text-center mb-6"><p className="text-doubt-muted">🗳️ التصويت جارٍ...</p></div>
        )}

        {/* RESULT */}
        {session.phase === GamePhase.RESULT && (
          <div className="text-center mb-6 animate-fade-in w-full max-w-sm">
            {voteResult?.eliminated ? (
              <div>
                <div className="text-5xl mb-3">⚖️</div>
                <p className="text-2xl font-bold text-doubt-accent mb-2">تم طرد {voteResult.eliminatedName}!</p>
              </div>
            ) : voteResult?.isTie ? (
              <div>
                <div className="text-5xl mb-3">⚖️</div>
                <p className="text-2xl font-bold text-doubt-gold mb-2">تعادل! لا أحد يُطرد</p>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-3">🤷</div>
                <p className="text-2xl font-bold text-doubt-muted mb-2">لم يصوّت أحد</p>
              </div>
            )}
            {voteResult && voteResult.voteCounts.length > 0 && (
              <div className="mt-4 space-y-2">
                {voteResult.voteCounts.map((vc) => (
                  <div key={vc.playerId} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                    <span className="flex-1 text-right text-sm">{vc.playerName}</span>
                    <div className="flex gap-1">
                      {Array.from({ length: vc.count }).map((_, i) => (<span key={i} className="text-xs">🗳️</span>))}
                    </div>
                    <span className="text-xs text-doubt-gold font-mono w-6 text-left">{vc.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!amIAlive && !isChatPhase && session.phase !== GamePhase.VOTING && session.phase !== GamePhase.RESULT && session.phase !== GamePhase.NIGHT && (
          <div className="text-center mb-6"><p className="text-doubt-muted text-lg">👻 أنت تشاهد كمتفرج</p></div>
        )}

        {/* Players List */}
        {!isChatPhase && session.phase !== GamePhase.NIGHT && (
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-doubt-muted text-sm">اللاعبون</h3>
              <span className="text-xs text-doubt-gold">{alivePlayers.length} حي / {session.players.length} إجمالي</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {alivePlayers.map((p) => (
                <div key={p.id} className={`text-center p-2 rounded-lg ${
                  p.id === playerId ? 'bg-white/10 border border-doubt-gold/30' : 'bg-white/5'
                }`}>
                  <div className="text-lg mb-1">👤</div>
                  <p className="text-xs truncate">{p.name}</p>
                </div>
              ))}
            </div>
            {deadPlayers.length > 0 && (
              <div className="border-t border-white/5 pt-2">
                <p className="text-doubt-muted text-xs mb-2">المُقصَون:</p>
                <div className="flex flex-wrap gap-2">
                  {deadPlayers.map((p) => (
                    <span key={p.id} className="text-xs text-doubt-muted/50 bg-white/5 px-2 py-1 rounded">💀 {p.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-doubt-accent text-center mt-4 text-sm">{error}</p>}
      </div>
    );
  }

  // LOBBY
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 phase-lobby phase-transition">
      <div className="text-center mb-8 animate-fade-in">
        <p className="text-doubt-muted text-sm mb-2">كود الجلسة</p>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-5xl font-mono font-bold tracking-[0.3em] text-doubt-gold">{session.code}</h1>
          <button onClick={() => navigator.clipboard.writeText(session.code)}
            className="text-doubt-muted hover:text-doubt-gold transition-colors p-2">📋</button>
        </div>
        <p className="text-doubt-muted text-sm mt-2">شارك الكود مع أصدقائك</p>
      </div>

      <div className="w-full max-w-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-doubt-muted">اللاعبون</h2>
          <span className="text-doubt-gold font-mono">{session.players.length}/12</span>
        </div>
        <div className="space-y-2">
          {session.players.map((p, i) => (
            <div key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl animate-fade-in ${
                p.id === playerId ? 'bg-white/10 border border-doubt-gold/20' : 'bg-white/5'
              }`} style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="text-2xl">{p.isHost ? '👑' : '👤'}</span>
              <span className="flex-1 text-lg">{p.name}</span>
              {p.id === playerId && <span className="text-xs text-doubt-gold bg-doubt-gold/10 px-2 py-1 rounded-full">أنت</span>}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <button onClick={startGame} disabled={session.players.length < 2}
          className={`w-full max-w-sm py-4 rounded-xl text-xl font-bold transition-all ${
            session.players.length >= 2
              ? 'bg-doubt-accent hover:bg-doubt-accent/80 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-white/5 text-doubt-muted cursor-not-allowed'
          }`}>
          {session.players.length >= 2 ? '🚀 ابدأ اللعبة' : `⏳ يجب ${2 - session.players.length} لاعب آخر`}
        </button>
      )}
      {!isHost && <p className="text-center text-doubt-muted">⏳ في انتظار المضيف...</p>}
      {error && <p className="text-doubt-accent text-center mt-4">{error}</p>}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center phase-lobby">
        <p className="text-2xl text-doubt-muted animate-pulse">جاري التحميل...</p>
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
