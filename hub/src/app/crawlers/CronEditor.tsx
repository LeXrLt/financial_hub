'use client';

import { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface CronEditorProps {
  sourceType: string;
  currentCron: string;
}

export function CronEditor({ sourceType, currentCron }: CronEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [cron, setCron] = useState(currentCron);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      const res = await fetch('/api/crawlers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType, cron_expression: cron }),
      });

      if (res.ok) {
        setIsEditing(false);
        window.location.reload();
      } else {
        alert('保存失败，请检查 Cron 表达式格式');
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="px-2 py-1 text-xs border rounded w-32"
          placeholder="0 */6 * * *"
        />
        <button
          onClick={save}
          disabled={isSaving}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={() => { setIsEditing(false); setCron(currentCron); }}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span>{currentCron}</span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
      >
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}
