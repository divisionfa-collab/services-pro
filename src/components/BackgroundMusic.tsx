'use client';

import { useEffect, useRef, useState } from 'react';

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isPlaying, setIsPlaying] = useState(false);

  // تحميل الإعدادات المحفوظة
  useEffect(() => {
    try {
      const savedMuted = localStorage.getItem('bg-muted');
      const savedVolume = localStorage.getItem('bg-volume');
      if (savedMuted) setIsMuted(savedMuted === 'true');
      if (savedVolume) setVolume(parseFloat(savedVolume));
    } catch {}
  }, []);

  // تحديث الصوت
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
    try {
      localStorage.setItem('bg-muted', String(isMuted));
      localStorage.setItem('bg-volume', String(volume));
    } catch {}
  }, [isMuted, volume]);

  const tryPlay = () => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  // محاولة تشغيل عند أول تفاعل
  useEffect(() => {
    const handleInteraction = () => { tryPlay(); };
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [isPlaying]);

  return (
    <>
      <audio
        ref={audioRef}
        src="/music/125.mp3"
        loop
        autoPlay
        onCanPlay={tryPlay}
      />

      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2
                      bg-black/50 backdrop-blur-sm px-3 py-2 rounded-full
                      border border-white/10">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="text-lg transition-all hover:scale-110"
          title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 h-1 accent-doubt-gold cursor-pointer"
          dir="ltr"
        />
      </div>
    </>
  );
}
