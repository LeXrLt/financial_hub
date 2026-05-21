import { History } from 'lucide-react';
import Link from 'next/link';
import { query } from '@/lib/db/query';

interface CrawlRun {
  id: number;
  target_name: string;
  source_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_found: number;
  items_new: number;
  items_failed: number;
  error_message: string | null;
  duration_ms: number | null;
}

async function getRuns(): Promise<CrawlRun[]> {
  try {
    const result = await query<CrawlRun>(
      `SELECT cr.id, ct.target_name, ct.source_type, cr.status,
              cr.started_at, cr.finished_at, cr.items_found, cr.items_new,
              cr.items_failed, cr.error_message, cr.duration_ms
       FROM crawl_runs cr
       JOIN crawl_targets ct ON cr.target_id = ct.id
       ORDER BY cr.started_at DESC
       LIMIT 100`
    );
    return result.rows;
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    running: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
  };
  const color = colors[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

export default async function RunsPage() {
  const runs = await getRuns();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-7 h-7 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">运行日志</h1>
            </div>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/targets" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                抓取目标
              </Link>
              <Link href="/runs" className="text-sm font-medium text-indigo-600">
                运行日志
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {runs.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">发现</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">新增</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">失败</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">耗时</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">开始时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">错误</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{run.target_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{run.source_type}</td>
                    <td className="px-6 py-4"><StatusBadge status={run.status} /></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{run.items_found}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{run.items_new}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{run.items_failed}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{formatDuration(run.duration_ms)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(run.started_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-500 max-w-xs truncate">
                      {run.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500">暂无运行记录</div>
          )}
        </div>
      </main>
    </div>
  );
}
