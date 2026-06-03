import { Settings, Plus, Play } from 'lucide-react';
import Link from 'next/link';
import { query } from '@/lib/db/query';
import { ToggleButton } from './ToggleButton';
import { CronEditor } from './CronEditor';
import { TriggerButton } from './TriggerButton';

export const dynamic = 'force-dynamic';

interface CrawlerSchedule {
  id: number;
  source_type: string;
  enabled: boolean;
  cron_expression: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
}

async function getCrawlers(): Promise<CrawlerSchedule[]> {
  try {
    const result = await query<CrawlerSchedule>(
      'SELECT * FROM crawler_schedules ORDER BY source_type'
    );
    return result.rows;
  } catch {
    return [];
  }
}

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">-</span>;
  
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    running: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };
  
  return (
    <span className={`px-2 py-1 text-xs rounded ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export default async function CrawlersPage() {
  const crawlers = await getCrawlers();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-7 h-7 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">爬虫调度管理</h1>
            </div>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/targets" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                抓取目标
              </Link>
              <Link href="/runs" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                运行日志
              </Link>
              <Link href="/crawlers" className="text-sm font-medium text-indigo-600">
                调度管理
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">爬虫类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cron 表达式</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最后运行</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">运行状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {crawlers.map((crawler) => (
                <tr key={crawler.source_type} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <StatusDot enabled={crawler.enabled} />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 capitalize">
                    {crawler.source_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    <CronEditor 
                      sourceType={crawler.source_type} 
                      currentCron={crawler.cron_expression} 
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {crawler.last_run_at
                      ? new Date(crawler.last_run_at).toLocaleString('zh-CN')
                      : '从未'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={crawler.last_run_status} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <ToggleButton sourceType={crawler.source_type} enabled={crawler.enabled} />
                      <TriggerButton sourceType={crawler.source_type} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">说明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 爬虫调度按 source_type（如 substack, youtube）分组管理</li>
            <li>• 每个爬虫类型的所有 enabled 目标会在定时任务触发时一起被抓取</li>
            <li>• Cron 表达式格式：分 时 日 月 周（如 &quot;0 */6 * * *&quot; 表示每6小时）</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
