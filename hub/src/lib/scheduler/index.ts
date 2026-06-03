/**
 * 调度器核心 - 管理定时任务的生命周期
 * Scheduler Core - Manages scheduled crawl jobs
 */

import { schedule, ScheduledTask, validate } from 'node-cron';
import { query } from '@/lib/db/query';
import {
  CrawlTarget,
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
  private tasks: Map<number, ScheduledTask>;
  private eventHandlers: Set<SchedulerEventHandler>;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.runner = new JobRunner(this.config);
    this.tasks = new Map();
    this.eventHandlers = new Set();
    this.state = {
      isRunning: false,
      jobs: new Map(),
      runningJobs: new Set(),
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

    // 初始加载任务
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
    for (const [targetId, task] of this.tasks) {
      task.stop();
      console.log(`[Scheduler] Stopped task for target ${targetId}`);
    }
    this.tasks.clear();

    this.state.isRunning = false;
    this.emit({ type: 'scheduler:stopped', timestamp: new Date() });

    console.log('[Scheduler] Stopped');
  }

  /**
   * 重载所有任务
   * Reload all jobs from database
   */
  async reloadJobs(): Promise<void> {
    console.log('[Scheduler] Reloading jobs from database...');

    try {
      const result = await query<CrawlTarget>(
        `SELECT * FROM crawl_targets 
         WHERE enabled = true 
         ORDER BY id`
      );

      const targets = result.rows;
      const currentIds = new Set(this.tasks.keys());
      const newIds = new Set(targets.map((t) => t.id));

      // 停止已删除或禁用的任务
      for (const targetId of currentIds) {
        if (!newIds.has(targetId)) {
          this.stopTask(targetId);
        }
      }

      // 添加或更新任务
      for (const target of targets) {
        this.updateOrCreateTask(target);
      }

      this.state.lastReloadAt = new Date();
      this.emit({ type: 'scheduler:reload', timestamp: new Date() });

      console.log(`[Scheduler] Reloaded ${targets.length} active jobs`);
    } catch (err) {
      console.error('[Scheduler] Failed to reload jobs:', err);
    }
  }

  /**
   * 触发立即执行（用于手动触发）
   * Trigger immediate execution
   */
  async triggerNow(targetId: number): Promise<boolean> {
    const target = await this.getTarget(targetId);
    if (!target) {
      console.error(`[Scheduler] Target ${targetId} not found`);
      return false;
    }

    if (!target.enabled) {
      console.error(`[Scheduler] Target ${targetId} is disabled`);
      return false;
    }

    if (this.state.runningJobs.has(targetId)) {
      console.error(`[Scheduler] Target ${targetId} is already running`);
      return false;
    }

    // 直接执行，不检查并发限制（用户手动触发优先）
    this.executeJob(target);
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
   * 私有方法：从数据库获取单个目标
   */
  private async getTarget(targetId: number): Promise<CrawlTarget | null> {
    const result = await query<CrawlTarget>(
      'SELECT * FROM crawl_targets WHERE id = $1',
      [targetId]
    );
    return result.rows[0] || null;
  }

  /**
   * 私有方法：更新或创建定时任务
   */
  private updateOrCreateTask(target: CrawlTarget): void {
    const existingTask = this.tasks.get(target.id);

    // 检查 cron 表达式是否有效
    if (!this.isValidCron(target.cron_expression)) {
      console.warn(`[Scheduler] Invalid cron expression for target ${target.id}: ${target.cron_expression}`);
      if (existingTask) {
        this.stopTask(target.id);
      }
      return;
    }

    // 如果任务已存在且表达式未变，跳过
    if (existingTask) {
      const job = this.state.jobs.get(target.id);
      if (job && job.cronExpression === target.cron_expression) {
        // 只更新元数据
        this.updateJobMetadata(target);
        return;
      }
      // cron 表达式变了，停止旧任务
      this.stopTask(target.id);
    }

    // 创建新任务
    const scheduledJob: ScheduledJob = {
      targetId: target.id,
      sourceType: target.source_type,
      targetName: target.target_name,
      cronExpression: target.cron_expression,
      isRunning: false,
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      errorCount: 0,
    };

    this.state.jobs.set(target.id, scheduledJob);

    // 创建 cron 任务
    const task = schedule(target.cron_expression, () => {
      this.onCronTrigger(target);
    });

    this.tasks.set(target.id, task);

    // 计算下次运行时间
    scheduledJob.nextRunAt = this.getNextRunDate(target.cron_expression);

    this.emit({
      type: 'job:scheduled',
      timestamp: new Date(),
      targetId: target.id,
      data: scheduledJob,
    });

    console.log(`[Scheduler] Scheduled target ${target.id} (${target.target_name}) with cron: ${target.cron_expression}`);
  }

  /**
   * 私有方法：停止单个任务
   */
  private stopTask(targetId: number): void {
    const task = this.tasks.get(targetId);
    if (task) {
      task.stop();
      this.tasks.delete(targetId);
      console.log(`[Scheduler] Stopped task for target ${targetId}`);
    }
    this.state.jobs.delete(targetId);
  }

  /**
   * 私有方法：更新任务元数据
   */
  private updateJobMetadata(target: CrawlTarget): void {
    const job = this.state.jobs.get(target.id);
    if (job) {
      job.sourceType = target.source_type;
      job.targetName = target.target_name;
    }
  }

  /**
   * 私有方法：cron 触发时执行
   */
  private async onCronTrigger(target: CrawlTarget): Promise<void> {
    const job = this.state.jobs.get(target.id);
    if (!job) return;

    // 检查并发限制
    if (this.state.runningJobs.size >= this.config.maxConcurrentJobs) {
      console.log(`[Scheduler] Max concurrent jobs reached, skipping target ${target.id}`);
      return;
    }

    // 检查是否已在运行
    if (this.state.runningJobs.has(target.id)) {
      console.log(`[Scheduler] Target ${target.id} already running, skipping`);
      return;
    }

    await this.executeJob(target);
  }

  /**
   * 私有方法：执行具体任务
   */
  private async executeJob(target: CrawlTarget): Promise<void> {
    const job = this.state.jobs.get(target.id);
    if (!job) return;

    this.state.runningJobs.add(target.id);
    job.isRunning = true;
    job.lastRunAt = new Date();
    job.runCount++;

    this.emit({
      type: 'job:started',
      timestamp: new Date(),
      targetId: target.id,
    });

    console.log(`[Scheduler] Executing job for target ${target.id} (${target.target_name})`);

    try {
      const result = await this.runner.run(target);

      if (result.success) {
        this.emit({
          type: 'job:completed',
          timestamp: new Date(),
          targetId: target.id,
          data: result,
        });
        console.log(`[Scheduler] Job completed for target ${target.id} (${result.durationMs}ms)`);
      } else {
        job.errorCount++;
        this.emit({
          type: 'job:failed',
          timestamp: new Date(),
          targetId: target.id,
          data: result,
        });
        console.error(`[Scheduler] Job failed for target ${target.id}: ${result.error}`);
      }
    } catch (err) {
      job.errorCount++;
      this.emit({
        type: 'job:failed',
        timestamp: new Date(),
        targetId: target.id,
        data: { error: String(err) },
      });
      console.error(`[Scheduler] Unexpected error for target ${target.id}:`, err);
    } finally {
      this.state.runningJobs.delete(target.id);
      job.isRunning = false;
      // 更新下次运行时间
      job.nextRunAt = this.getNextRunDate(job.cronExpression);
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

  /**
   * 私有方法：计算下次运行时间
   */
  private getNextRunDate(cronExpression: string): Date | null {
    try {
      // 使用 cron-parser 或简单估算
      // 这里简化处理，实际可用 cron-parser 库
      const now = new Date();
      const task = schedule(cronExpression, () => {}, { scheduled: false });
      // node-cron 不直接提供下次运行时间，这里返回 null
      // 如果需要精确时间，可添加 cron-parser 依赖
      return null;
    } catch {
      return null;
    }
  }
}

export default CrawlScheduler;
