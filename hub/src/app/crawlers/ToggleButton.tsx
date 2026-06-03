'use client';

import { useState } from 'react';

interface ToggleButtonProps {
  sourceType: string;
  enabled: boolean;
}

export function ToggleButton({ sourceType, enabled }: ToggleButtonProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [isLoading, setIsLoading] = useState(false);

  async function toggle() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/crawlers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType }),
      });

      if (res.ok) {
        setIsEnabled(!isEnabled);
        window.location.reload();
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      className={`px-3 py-1 text-xs rounded ${
        isEnabled
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {isLoading ? '...' : isEnabled ? '启用' : '禁用'}
    </button>
  );
}
