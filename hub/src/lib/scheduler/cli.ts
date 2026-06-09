#!/usr/bin/env tsx
/**
 * 调度器 CLI 入口（按 source_type 调度）
 * Scheduler CLI Entry Point
 *
 * 用法:
 *   bun run scheduler                      # 启动调度器
 *   bun run scheduler --trigger substack   # 立即触发 substack 爬虫
 *   bun run scheduler --reload               # 触发重载
 *   bun run scheduler --status               # 查看状态
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { CrawlScheduler } from './index';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env') });

// 解析命令行参数
function parseArgs(): { command: string; value?: string } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: bun run scheduler [选项]

选项:
  --trigger <type>  立即触发指定 source_type 的爬虫 (如: substack, youtube)
  --reload          触发调度器重载所有任务
  --status          查看当前调度器状态
  --help            显示帮助信息

示例:
  bun run scheduler                      # 启动调度器（前台运行）
  bun run scheduler --trigger substack   # 立即执行 substack 爬虫
`);
    process.exit(0);
  }

  const triggerIndex = args.indexOf('--trigger');
  if (triggerIndex !== -1 && args[triggerIndex + 1]) {
    return { command: 'trigger', value: args[triggerIndex + 1] };
  }

  if (args.includes('--reload')) {
    return { command: 'reload' };
  }

  if (args.includes('--status')) {
    return { command: 'status' };
  }

  return { command: 'start' };
}

// 主函数
async function main(): Promise<void> {
  const { command, value } = parseArgs();

  // 确定 crawlers 基础路径
  const crawlersBasePath = resolve(process.cwd(), '..', 'crawlers');

  // 创建调度器实例
  const scheduler = new CrawlScheduler({
    maxConcurrentJobs: parseInt(process.env.SCHEDULER_MAX_CONCURRENT || '3', 10),
    pollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS || (60 * 1000).toString(), 10),
    crawlersBasePath,
  });

  // 注册事件处理器（用于日志输出）
  scheduler.onEvent((event) => {
    const timestamp = event.timestamp.toISOString();
    switch (event.type) {
      case 'scheduler:started':
        console.log(`[${timestamp}] 🚀 Scheduler started`);
        break;
      case 'scheduler:stopped':
        console.log(`[${timestamp}] 🛑 Scheduler stopped`);
        break;
      case 'scheduler:reload':
        console.log(`[${timestamp}] 🔄 Jobs reloaded`);
        break;
      case 'job:scheduled':
        console.log(`[${timestamp}] 📅 Job scheduled: type=${event.sourceType}`);
        break;
      case 'job:started':
        console.log(`[${timestamp}] ▶️  Job started: type=${event.sourceType}`);
        break;
      case 'job:completed':
        console.log(`[${timestamp}] ✅ Job completed: type=${event.sourceType}`);
        break;
      case 'job:failed':
        console.log(`[${timestamp}] ❌ Job failed: type=${event.sourceType}`);
        break;
      case 'job:timeout':
        console.log(`[${timestamp}] ⏱️  Job timeout: type=${event.sourceType}`);
        break;
    }
  });

  // 处理命令
  switch (command) {
    case 'start':
      console.log('╔═══════════════════════════════════════════════════╗');
      console.log('║       Crawl Scheduler (独立进程模式)                ║');
      console.log('╚═══════════════════════════════════════════════════╝');
      console.log(`Crawlers path: ${crawlersBasePath}`);
      console.log(`Max concurrent jobs: ${scheduler.getState().jobs.size}`);
      console.log('Press Ctrl+C to stop\n');

      await scheduler.start();

      // 保持进程运行
      process.on('SIGINT', async () => {
        console.log('\n[CLI] Received SIGINT, shutting down...');
        await scheduler.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n[CLI] Received SIGTERM, shutting down...');
        await scheduler.stop();
        process.exit(0);
      });

      // 防止进程退出
      await new Promise(() => {});
      break;

    case 'trigger':
      console.log(`[CLI] Triggering ${value}...`);
      await scheduler.start();
      const success = await scheduler.triggerNow(value!);
      if (success) {
        console.log(`[CLI] ${value} triggered successfully`);
        // 等待任务完成
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.error(`[CLI] Failed to trigger ${value}`);
        process.exit(1);
      }
      await scheduler.stop();
      break;

    case 'reload':
      console.log('[CLI] Reloading scheduler jobs...');
      await scheduler.start();
      await scheduler.reloadJobs();
      await scheduler.stop();
      console.log('[CLI] Reload complete');
      break;

    case 'status':
      await scheduler.start();
      const state = scheduler.getState();
      const jobs = scheduler.getJobs();

      console.log('\n=== Scheduler Status ===');
      console.log(`Running: ${state.isRunning}`);
      console.log(`Last reload: ${state.lastReloadAt?.toISOString() || 'never'}`);
      console.log(`Active jobs: ${jobs.length}`);
      console.log(`Running jobs: ${state.runningJobs.size}`);

      if (jobs.length > 0) {
        console.log('\n--- Job Details ---');
        for (const job of jobs) {
          const status = job.isRunning ? '🏃 RUNNING' : '⏳ IDLE';
          console.log(`  [${job.sourceType}]`);
          console.log(`    Cron: ${job.cronExpression}`);
          console.log(`    Enabled: ${job.enabled}`);
          console.log(`    Status: ${status}`);
          console.log(`    Runs: ${job.runCount}, Errors: ${job.errorCount}`);
          console.log(`    Last run: ${job.lastRunAt?.toISOString() || 'never'}`);
          console.log('');
        }
      }

      await scheduler.stop();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// 运行主函数
main().catch((err) => {
  console.error('[CLI] Fatal error:', err);
  process.exit(1);
});
