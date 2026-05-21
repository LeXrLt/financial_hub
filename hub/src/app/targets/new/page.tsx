'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewTargetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const body = {
      source_type: formData.get('source_type'),
      target_name: formData.get('target_name'),
      target_identifier: formData.get('target_identifier'),
      cron_expression: formData.get('cron_expression'),
      notes: formData.get('notes'),
    };

    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create target');
      }

      router.push('/targets');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Link href="/targets" className="text-gray-500 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">添加抓取目标</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="source_type" className="block text-sm font-medium text-gray-700 mb-1">
              数据来源
            </label>
            <select
              id="source_type"
              name="source_type"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="wechat">微信公众号</option>
              <option value="youtube">YouTube</option>
              <option value="xiaoyuzhou">小宇宙播客</option>
            </select>
          </div>

          <div>
            <label htmlFor="target_name" className="block text-sm font-medium text-gray-700 mb-1">
              目标名称
            </label>
            <input
              id="target_name"
              name="target_name"
              type="text"
              required
              placeholder="例如：半佛仙人"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="target_identifier" className="block text-sm font-medium text-gray-700 mb-1">
              目标标识
            </label>
            <input
              id="target_identifier"
              name="target_identifier"
              type="text"
              required
              placeholder="例如：公众号ID、频道URL、播客ID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="cron_expression" className="block text-sm font-medium text-gray-700 mb-1">
              抓取频率 (cron)
            </label>
            <input
              id="cron_expression"
              name="cron_expression"
              type="text"
              defaultValue="0 */6 * * *"
              placeholder="0 */6 * * *"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">默认每6小时执行一次</p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/targets"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建目标'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
