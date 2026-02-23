'use client';

// Sprint 1: Game page redirects to lobby
// Future sprints will have dedicated game UI
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GamePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center phase-lobby">
      <p className="text-doubt-muted">جاري التوجيه...</p>
    </div>
  );
}
