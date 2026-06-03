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
  cron_expression: string;
  last_crawl_at: Date | null;
  last_crawl_status: string | null;
  last_error: string | null;
  total_items: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduledJob {
  targetId: number;
  sourceType: string;
  targetName: string;
  cronExpression: string;
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  runCount: number;
  errorCount: number;
}

export interface JobExecutionResult {
  success: boolean;
  targetId: number;
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
  jobs: Map<number, ScheduledJob>;
  runningJobs: Set<number>;
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
  targetId?: number;
  data?: unknown;
}

export type SchedulerEventHandler = (event: SchedulerEvent) => void;
