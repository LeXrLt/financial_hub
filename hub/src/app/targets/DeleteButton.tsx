'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function DeleteButton({ targetId, targetName }: { targetId: number; targetName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`确定要删除目标 "${targetName}" 吗？\n此操作不可撤销。`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/targets/${targetId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '删除失败');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-500 hover:text-red-700 disabled:opacity-50 inline-flex items-center gap-1"
      title="删除"
    >
      <Trash2 className="w-4 h-4" />
      {loading ? '...' : ''}
    </button>
  );
}
