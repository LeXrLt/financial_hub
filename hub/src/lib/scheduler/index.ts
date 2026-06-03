/**
 * 调度器核心 - 管理定时任务的生命周期（按 source_type 调度）
 * Scheduler Core - Manages scheduled crawl jobs by source_type
 */

import { schedule, ScheduledTask, validate } from 'node-cron';
import { query } from '@/lib/db/query';
import {
  CrawlerSchedule,
  ScheduledJob,
  SchedulerConfig,
  SchedulerState,
  SchedulerEvent,
  SchedulerEventHandler,
} from './types';
import JobRunner from './runner';

// 默认配置
const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrentJobs: 3,
  jobTimeoutMs: 30 * 60 * 1000, // 30分钟
  pollIntervalMs: 60 * 1000, // 1分钟轮询
  crawlersBasePath: require('path').resolve(process.cwd(), '..', 'crawlers'),
};

export class CrawlScheduler {
  private config: SchedulerConfig;
  private state: SchedulerState;
  private runner: JobRunner;
  private tasks: Map<string, ScheduledTask>;  // key: source_type
  private eventHandlers: Set<SchedulerEventHandler>;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.runner = new JobRunner(this.config);
    this.tasks = new Map();
    this.eventHandlers = new Set();
    this.state = {
      isRunning: false,
      jobs: new Map(),  // key: source_type
      runningJobs: new Set(),  // source_types
      lastReloadAt: null,
    };
  }

  /**
   * 注册事件处理器
   * Register event handler
   */
  onEvent(handler: SchedulerEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * 移除事件处理器
   * Remove event handler
   */
  offEvent(handler: SchedulerEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * 触发事件
   * Emit event
   */
  private emit(event: SchedulerEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[Scheduler] Event handler error:', err);
      }
    }
  }

  /**
   * 启动调度器
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting...');
    console.log(`[Scheduler] Config: ${JSON.stringify(this.config, null, 2)}`);

    // 初始加载任务（从 crawler_schedules 表）
    await this.reloadJobs();

    // 启动定期重载（检测数据库变更）
    this.pollTimer = setInterval(() => {
      this.reloadJobs();
    }, this.config.pollIntervalMs);

    this.state.isRunning = true;
    this.emit({ type: 'scheduler:started', timestamp: new Date() });

    console.log('[Scheduler] Started successfully');
  }

  /**
   * 停止调度器
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      return;
    }

    console.log('[Scheduler] Stopping...');

    // 停止轮询
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // 等待正在运行的任务完成
    if (this.state.runningJobs.size > 0) {
      console.log(`[Scheduler] Waiting for ${this.state.runningJobs.size} running jobs...`);
      await this.waitForRunningJobs();
    }

    // 停止所有定时任务
    for (const [sourceType, task] of this.tasks) {
      task.stop();
      console.log(`[Scheduler] Stopped task for ${sourceType}`);
    }
    this.tasks.clear();

    this.state.isRunning = false;
    this.emit({ type: 'scheduler:stopped', timestamp: new Date() });

    console.log('[Scheduler] Stopped');
  }

  /**
   * 重载所有任务
   * Reload all jobs from crawler_schedules
   */
  async reloadJobs(): Promise<void> {
    console.log('[Scheduler] Reloading jobs from database...');

    try {
      // 从 crawler_schedules 表加载配置
      const result = await query<CrawlerSchedule>(
        `SELECT * FROM crawler_schedules 
         WHERE enabled = true 
         ORDER BY source_type`
      );

      const schedules = result.rows;
      const currentTypes = new Set(this.tasks.keys());
      const newTypes = new Set(schedules.map((s) => s.source_type));

      // 停止已删除或禁用的任务
      for (const sourceType of currentTypes) {
        if (!newTypes.has(sourceType)) {
          this.stopTask(sourceType);
        }
      }

      // 添加或更新任务
      for (const schedule of schedules) {
        this.updateOrCreateTask(schedule);
      }

      this.state.lastReloadAt = new Date();
      this.emit({ type: 'scheduler:reload', timestamp: new Date() });

      console.log(`[Scheduler] Reloaded ${schedules.length} active jobs`);
    } catch (err) {
      console.error('[Scheduler] Failed to reload jobs:', err);
    }
  }

  /**
   * 触发立即执行（按 source_type）
   * Trigger immediate execution by source_type
   */
  async triggerNow(sourceType: string): Promise<boolean> {
    const schedule = await this.getSchedule(sourceType);
    if (!schedule) {
      console.error(`[Scheduler] Schedule for ${sourceType} not found`);
      return false;
    }

    if (!schedule.enabled) {
      console.error(`[Scheduler] Schedule for ${sourceType} is disabled`);
      return false;
    }

    if (this.state.runningJobs.has(sourceType)) {
      console.error(`[Scheduler] ${sourceType} is already running`);
      return false;
    }

    // 直接执行，不检查并发限制（用户手动触发优先）
    this.executeJob(schedule);
    return true;
  }

  /**
   * 获取当前状态
   * Get current state
   */
  getState(): SchedulerState {
    return {
      ...this.state,
      jobs: new Map(this.state.jobs),
      runningJobs: new Set(this.state.runningJobs),
    };
  }

  /**
   * 获取所有任务信息
   * Get all job information
   */
  getJobs(): ScheduledJob[] {
    return Array.from(this.state.jobs.values());
  }

  /**
   * 私有方法：从数据库获取单个调度配置
   */
  private async getSchedule(sourceType: string): Promise<CrawlerSchedule | null> {
    const result = await query<CrawlerSchedule>(
      'SELECT * FROM crawler_schedules WHERE source_type = $1',
      [sourceType]
    );
    return result.rows[0] || null;
  }

  /**
   * 私有方法：更新或创建定时任务
   */
  private updateOrCreateTask(crawlerSchedule: CrawlerSchedule): void {
    const existingTask = this.tasks.get(crawlerSchedule.source_type);

    // 检查 cron 表达式是否有效
    if (!this.isValidCron(crawlerSchedule.cron_expression)) {
      console.warn(`[Scheduler] Invalid cron expression for ${crawlerSchedule.source_type}: ${crawlerSchedule.cron_expression}`);
      if (existingTask) {
        this.stopTask(crawlerSchedule.source_type);
      }
      return;
    }

    // 如果任务已存在且表达式未变，跳过
    if (existingTask) {
      const job = this.state.jobs.get(crawlerSchedule.source_type);
      if (job && job.cronExpression === crawlerSchedule.cron_expression) {
        return;
      }
      // cron 表达式变了，停止旧任务
      this.stopTask(crawlerSchedule.source_type);
    }

    // 创建新任务
    const scheduledJob: ScheduledJob = {
      sourceType: crawlerSchedule.source_type,
      cronExpression: crawlerSchedule.cron_expression,
      enabled: crawlerSchedule.enabled,
      isRunning: false,
      lastRunAt: crawlerSchedule.last_run_at,
      nextRunAt: null,
      runCount: 0,
      errorCount: 0,
    };

    this.state.jobs.set(crawlerSchedule.source_type, scheduledJob);

    // 创建 cron 任务
    const task = schedule(crawlerSchedule.cron_expression, () => {
      this.onCronTrigger(crawlerSchedule);
    });

    this.tasks.set(crawlerSchedule.source_type, task);

    this.emit({
      type: 'job:scheduled',
      timestamp: new Date(),
      sourceType: crawlerSchedule.source_type,
      data: scheduledJob,
    });

    console.log(`[Scheduler] Scheduled ${crawlerSchedule.source_type} with cron: ${crawlerSchedule.cron_expression}`);
  }

  /**
   * 私有方法：停止单个任务
   */
  private stopTask(sourceType: string): void {
    const task = this.tasks.get(sourceType);
    if (task) {
      task.stop();
      this.tasks.delete(sourceType);
      console.log(`[Scheduler] Stopped task for ${sourceType}`);
    }
    this.state.jobs.delete(sourceType);
  }

  /**
   * 私有方法：cron 触发时执行
   */
  private async onCronTrigger(schedule: CrawlerSchedule): Promise<void> {
    const job = this.state.jobs.get(schedule.source_type);
    if (!job) return;

    // 检查并发限制
    if (this.state.runningJobs.size >= this.config.maxConcurrentJobs) {
      console.log(`[Scheduler] Max concurrent jobs reached, skipping ${schedule.source_type}`);
      return;
    }

    // 检查是否已在运行
    if (this.state.runningJobs.has(schedule.source_type)) {
      console.log(`[Scheduler] ${schedule.source_type} already running, skipping`);
      return;
    }

    await this.executeJob(schedule);
  }

  /**
   * 私有方法：执行具体任务
   */
  private async executeJob(schedule: CrawlerSchedule): Promise<void> {
    const job = this.state.jobs.get(schedule.source_type);
    if (!job) return;

    this.state.runningJobs.add(schedule.source_type);
    job.isRunning = true;
    job.lastRunAt = new Date();
    job.runCount++;

    this.emit({
      type: 'job:started',
      timestamp: new Date(),
      sourceType: schedule.source_type,
    });

    console.log(`[Scheduler] Executing job for ${schedule.source_type}`);

    try {
      const result = await this.runner.runBySourceType(schedule.source_type);

      // 更新数据库中的最后运行状态
      await query(
        `UPDATE crawler_schedules 
         SET last_run_at = NOW(),
             last_run_status = $1,
             last_error = $2,
             updated_at = NOW()
         WHERE source_type = $3`,
        [result.success ? 'success' : 'failed', result.error || null, schedule.source_type]
      );

      if (result.success) {
        this.emit({
          type: 'job:completed',
          timestamp: new Date(),
          sourceType: schedule.source_type,
          data: result,
        });
        console.log(`[Scheduler] Job completed for ${schedule.source_type} (${result.durationMs}ms)`);
      } else {
        job.errorCount++;
        this.emit({
          type: 'job:failed',
          timestamp: new Date(),
          sourceType: schedule.source_type,
          data: result,
        });
        console.error(`[Scheduler] Job failed for ${schedule.source_type}: ${result.error}`);
      }
    } catch (err) {
      job.errorCount++;
      // 更新失败状态
      await query(
        `UPDATE crawler_schedules 
         SET last_run_at = NOW(),
             last_run_status = 'failed',
             last_error = $1,
             updated_at = NOW()
         WHERE source_type = $2`,
        [String(err), schedule.source_type]
      );
      this.emit({
        type: 'job:failed',
        timestamp: new Date(),
        sourceType: schedule.source_type,
        data: { error: String(err) },
      });
      console.error(`[Scheduler] Unexpected error for ${schedule.source_type}:`, err);
    } finally {
      this.state.runningJobs.delete(schedule.source_type);
      job.isRunning = false;
    }
  }

  /**
   * 私有方法：等待所有运行中的任务完成
   */
  private async waitForRunningJobs(): Promise<void> {
    const checkInterval = 1000;
    const maxWaitMs = 60 * 1000; // 最多等1分钟
    const startTime = Date.now();

    while (this.state.runningJobs.size > 0) {
      if (Date.now() - startTime > maxWaitMs) {
        console.warn(`[Scheduler] Timeout waiting for jobs, ${this.state.runningJobs.size} still running`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
  }

  /**
   * 私有方法：验证 cron 表达式
   */
  private isValidCron(expression: string): boolean {
    return validate(expression);
  }
}

export default CrawlScheduler;
