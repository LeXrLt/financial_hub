'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ToggleButton({ targetId, enabled }: { targetId: number; enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await fetch(`/api/targets/${targetId}/toggle`, { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
    >
      {loading ? '...' : enabled ? '停用' : '启用'}
    </button>
  );
}
