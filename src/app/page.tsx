'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError('اكتب اسمك أولاً');
      return;
    }
    // نمرر الاسم عبر URL params للـ lobby
    router.push(`/lobby?name=${encodeURIComponent(playerName.trim())}&action=create`);
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError('اكتب اسمك أولاً');
      return;
    }
    if (!joinCode.trim() || joinCode.trim().length !== 4) {
      setError('أدخل كود الجلسة (4 أحرف)');
      return;
    }
    router.push(`/lobby?name=${encodeURIComponent(playerName.trim())}&action=join&code=${joinCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center phase-lobby phase-transition p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-3 tracking-wider">
            <span className="text-doubt-accent">D</span>
            <span className="text-doubt-text">OUBT</span>
          </h1>
          <p className="text-doubt-muted text-lg">لعبة الشك</p>
        </div>

        {/* Main Menu */}
        {mode === 'menu' && (
          <div className="animate-fade-in space-y-4">
            {/* Name Input */}
            <div className="mb-8">
              <input
                type="text"
                placeholder="اسمك في اللعبة..."
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
                maxLength={15}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl
                           text-center text-xl text-doubt-text placeholder:text-doubt-muted/50
                           focus:outline-none focus:border-doubt-accent/50 focus:bg-white/10
                           transition-all duration-300"
              />
            </div>

            {/* Buttons */}
            <button
              onClick={() => { setError(''); setMode('create'); handleCreate(); }}
              className="w-full py-4 bg-doubt-accent hover:bg-doubt-accent/80
                         rounded-xl text-xl font-bold transition-all duration-300
                         hover:scale-[1.02] active:scale-[0.98]"
            >
              🎮 إنشاء جلسة جديدة
            </button>

            <button
              onClick={() => { setError(''); setMode('join'); }}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10
                         rounded-xl text-xl font-bold transition-all duration-300
                         hover:scale-[1.02] active:scale-[0.98]"
            >
              🚪 الانضمام بكود
            </button>

            {error && (
              <p className="text-doubt-accent text-center mt-4 animate-fade-in">{error}</p>
            )}
          </div>
        )}

        {/* Join Form */}
        {mode === 'join' && (
          <div className="animate-fade-in space-y-4">
            <div>
              <input
                type="text"
                placeholder="كود الجلسة (4 أحرف)"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                maxLength={4}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl
                           text-center text-3xl tracking-[0.5em] font-mono text-doubt-gold
                           placeholder:text-doubt-muted/50 placeholder:text-lg placeholder:tracking-normal
                           focus:outline-none focus:border-doubt-gold/50 focus:bg-white/10
                           transition-all duration-300 uppercase"
              />
            </div>

            <button
              onClick={handleJoin}
              className="w-full py-4 bg-doubt-gold hover:bg-doubt-gold/80 text-doubt-darker
                         rounded-xl text-xl font-bold transition-all duration-300
                         hover:scale-[1.02] active:scale-[0.98]"
            >
              🚪 انضمام
            </button>

            <button
              onClick={() => { setMode('menu'); setError(''); }}
              className="w-full py-3 text-doubt-muted hover:text-doubt-text
                         transition-colors text-lg"
            >
              → رجوع
            </button>

            {error && (
              <p className="text-doubt-accent text-center mt-4 animate-fade-in">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
