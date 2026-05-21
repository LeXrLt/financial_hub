import { Activity, Database, Radio, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { query } from '@/lib/db/query';

interface ComponentStatus {
  id: number;
  component_name: string;
  status: string;
  last_heartbeat: string | null;
  last_error: string | null;
}

interface RecentRun {
  id: number;
  target_name: string;
  source_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_new: number;
  error_message: string | null;
}

interface DataStat {
  source_type: string;
  total_items: number;
  active_targets: number;
}

async function getComponentStatus(): Promise<ComponentStatus[]> {
  try {
    const result = await query<ComponentStatus>(
      'SELECT * FROM component_status ORDER BY component_name'
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function getRecentRuns(): Promise<RecentRun[]> {
  try {
    const result = await query<RecentRun>(
      `SELECT cr.id, ct.target_name, ct.source_type, cr.status, 
              cr.started_at, cr.finished_at, cr.items_new, cr.error_message
       FROM crawl_runs cr
       JOIN crawl_targets ct ON cr.target_id = ct.id
       ORDER BY cr.started_at DESC
       LIMIT 20`
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function getDataStats(): Promise<DataStat[]> {
  try {
    const result = await query<DataStat>(
      `SELECT source_type, 
              SUM(total_items)::int as total_items,
              COUNT(*) FILTER (WHERE enabled = true)::int as active_targets
       FROM crawl_targets
       GROUP BY source_type`
    );
    return result.rows;
  } catch {
    return [];
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'degraded':
    case 'running':
      return <Clock className="w-5 h-5 text-yellow-500" />;
    case 'down':
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <AlertTriangle className="w-5 h-5 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: 'bg-green-100 text-green-800',
    success: 'bg-green-100 text-green-800',
    running: 'bg-blue-100 text-blue-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    down: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-800',
    pending: 'bg-gray-100 text-gray-800',
  };
  const color = colors[status] || colors.unknown;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const [components, recentRuns, stats] = await Promise.all([
    getComponentStatus(),
    getRecentRuns(),
    getDataStats(),
  ]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-7 h-7 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">Financial Hub</h1>
              <span className="text-sm text-gray-500">抓取系统监控</span>
            </div>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm font-medium text-indigo-600">
                Dashboard
              </Link>
              <Link href="/targets" className="text-sm font-medium text-gray-500 hover:text-gray-900">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.length > 0 ? (
            stats.map((stat) => (
              <div key={stat.source_type} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.source_type}</p>
                    <p className="text-2xl font-bold mt-1">{stat.total_items}</p>
                    <p className="text-xs text-gray-400 mt-1">{stat.active_targets} 个活跃目标</p>
                  </div>
                  <Database className="w-8 h-8 text-gray-300" />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
              暂无数据统计
            </div>
          )}
        </div>

        {/* Component Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-semibold">组件状态</h2>
            </div>
          </div>
          <div className="p-6">
            {components.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {components.map((comp) => (
                  <div key={comp.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                    <StatusIcon status={comp.status} />
                    <div>
                      <p className="text-sm font-medium">{comp.component_name}</p>
                      <p className="text-xs text-gray-400">
                        {comp.last_heartbeat
                          ? `最后心跳: ${new Date(comp.last_heartbeat).toLocaleString('zh-CN')}`
                          : '无心跳记录'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center">暂无组件注册</p>
            )}
          </div>
        </div>

        {/* Recent Runs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">最近运行记录</h2>
            <Link href="/runs" className="text-sm text-indigo-600 hover:text-indigo-800">
              查看全部 →
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentRuns.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">新增</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">开始时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{run.target_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{run.source_type}</td>
                      <td className="px-6 py-4"><StatusBadge status={run.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{run.items_new}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(run.started_at).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-500">暂无运行记录</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
