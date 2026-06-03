'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

interface TriggerButtonProps {
  sourceType: string;
}

export function TriggerButton({ sourceType }: TriggerButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function trigger() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/scheduler/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType }),
      });

      if (res.ok) {
        alert(`已触发 ${sourceType} 爬虫`);
      } else {
        const data = await res.json();
        alert(`触发失败: ${data.error || '未知错误'}`);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={trigger}
      disabled={isLoading}
      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
      title="立即触发"
    >
      <Play className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`} />
    </button>
  );
}
