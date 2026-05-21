import { Target, Plus } from 'lucide-react';
import Link from 'next/link';
import { query } from '@/lib/db/query';

interface CrawlTarget {
  id: number;
  source_type: string;
  target_name: string;
  target_identifier: string;
  enabled: boolean;
  cron_expression: string;
  last_crawl_at: string | null;
  last_crawl_status: string | null;
  last_error: string | null;
  total_items: number;
  notes: string | null;
}

async function getTargets(): Promise<CrawlTarget[]> {
  try {
    const result = await query<CrawlTarget>(
      'SELECT * FROM crawl_targets ORDER BY source_type, target_name'
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

export default async function TargetsPage() {
  const targets = await getTargets();

  const grouped = targets.reduce<Record<string, CrawlTarget[]>>((acc, t) => {
    if (!acc[t.source_type]) acc[t.source_type] = [];
    acc[t.source_type].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-7 h-7 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">抓取目标管理</h1>
            </div>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/targets" className="text-sm font-medium text-indigo-600">
                抓取目标
              </Link>
              <Link href="/runs" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                运行日志
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-end mb-6">
          <Link
            href="/targets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            添加目标
          </Link>
        </div>

        {Object.keys(grouped).length > 0 ? (
          Object.entries(grouped).map(([sourceType, items]) => (
            <div key={sourceType} className="mb-8">
              <h2 className="text-lg font-semibold mb-4 capitalize">{sourceType}</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">标识</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">频率</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">数据量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最后抓取</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((target) => (
                      <tr key={target.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <StatusDot enabled={target.enabled} />
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{target.target_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{target.target_identifier}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{target.cron_expression}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{target.total_items}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {target.last_crawl_at
                            ? new Date(target.last_crawl_at).toLocaleString('zh-CN')
                            : '从未'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Link
                            href={`/api/targets/${target.id}/toggle`}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            {target.enabled ? '停用' : '启用'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无抓取目标，请添加第一个目标</p>
          </div>
        )}
      </main>
    </div>
  );
}
