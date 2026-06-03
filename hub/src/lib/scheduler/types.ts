/**
 * 调度器类型定义
 * Crawl Scheduler Types
 */

export interface CrawlTarget {
  id: number;
  source_type: string;
  target_name: string;
  target_identifier: string;
  enabled: boolean;
  last_crawl_at: Date | null;
  last_crawl_status: string | null;
  last_error: string | null;
  total_items: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CrawlerSchedule {
  id: number;
  source_type: string;
  enabled: boolean;
  cron_expression: string;
  last_run_at: Date | null;
  last_run_status: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduledJob {
  sourceType: string;  // 爬虫类型（如 substack, youtube）
  cronExpression: string;
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  runCount: number;
  errorCount: number;
}

export interface JobExecutionResult {
  success: boolean;
  sourceType: string;  // 爬虫类型
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface SchedulerConfig {
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  pollIntervalMs: number;
  crawlersBasePath: string;
}

export interface SchedulerState {
  isRunning: boolean;
  jobs: Map<string, ScheduledJob>;  // key: source_type
  runningJobs: Set<string>;  // source_types currently running
  lastReloadAt: Date | null;
}

export type SchedulerEventType =
  | 'job:scheduled'
  | 'job:started'
  | 'job:completed'
  | 'job:failed'
  | 'job:timeout'
  | 'scheduler:started'
  | 'scheduler:stopped'
  | 'scheduler:reload';

export interface SchedulerEvent {
  type: SchedulerEventType;
  timestamp: Date;
  sourceType?: string;
  data?: unknown;
}

export type SchedulerEventHandler = (event: SchedulerEvent) => void;
