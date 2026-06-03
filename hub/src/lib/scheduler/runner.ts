/**
 * 任务执行器 - 负责执行单个抓取任务
 * Job Runner - Executes individual crawl tasks
 */

import { spawn } from 'child_process';
import { resolve, join } from 'path';
import { JobExecutionResult, CrawlTarget, SchedulerConfig } from './types';

// 默认配置
const DEFAULT_CONFIG: Partial<SchedulerConfig> = {
  jobTimeoutMs: 30 * 60 * 1000, // 30分钟超时
  crawlersBasePath: resolve(process.cwd(), '..', 'crawlers'),
};

export class JobRunner {
  private config: SchedulerConfig;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as SchedulerConfig;
  }

  /**
   * 执行单个抓取任务
   * Execute a single crawl job
   */
  async run(target: CrawlTarget): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const skillPath = this.getSkillPath(target.source_type);
    const venvPython = join(skillPath, '.venv', 'bin', 'python');
    const mainScript = join(skillPath, 'main.py');

    // 检查必要文件是否存在
    if (!this.fileExists(venvPython)) {
      return this.createErrorResult(
        target.id,
        startTime,
        `Virtual environment not found: ${venvPython}`
      );
    }

    if (!this.fileExists(mainScript)) {
      return this.createErrorResult(
        target.id,
        startTime,
        `Main script not found: ${mainScript}`
      );
    }

    return new Promise((resolve) => {
      // 不传递 --target-id，让 skill 自行查询所有 enabled 目标
      const args: string[] = [];
      const stdout: string[] = [];
      const stderr: string[] = [];

      console.log(`[Runner] Starting job ${target.id} (${target.target_name})`);
      console.log(`[Runner] Command: ${venvPython} main.py ${args.join(' ')}`);
      console.log(`[Runner] Working directory: ${skillPath}`);

      const child = spawn(venvPython, ['main.py', ...args], {
        cwd: skillPath,
        env: {
          ...process.env,
          // 确保 skill 能连接到正确的数据库
          POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
          POSTGRES_PORT: process.env.POSTGRES_PORT || '5432',
          POSTGRES_DB: process.env.POSTGRES_DB || 'financial_hub',
          POSTGRES_USER: process.env.POSTGRES_USER || 'hub',
          POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 收集输出
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout.push(chunk);
        // 实时输出到控制台（便于调试）
        process.stdout.write(`[Job ${target.id}] ${chunk}`);
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr.push(chunk);
        process.stderr.write(`[Job ${target.id} stderr] ${chunk}`);
      });

      // 设置超时
      const timeoutId = setTimeout(() => {
        console.warn(`[Runner] Job ${target.id} timed out after ${this.config.jobTimeoutMs}ms, killing...`);
        child.kill('SIGTERM');

        // 如果 SIGTERM 不起作用，5秒后强制杀死
        setTimeout(() => {
          if (!child.killed) {
            console.warn(`[Runner] Job ${target.id} force killing...`);
            child.kill('SIGKILL');
          }
        }, 5000);
      }, this.config.jobTimeoutMs);

      // 处理退出
      child.on('exit', (code, signal) => {
        clearTimeout(timeoutId);

        const durationMs = Date.now() - startTime;
        const stdoutStr = stdout.join('');
        const stderrStr = stderr.join('');

        console.log(`[Runner] Job ${target.id} exited with code ${code}, signal ${signal}`);

        resolve({
          success: code === 0,
          targetId: target.id,
          durationMs,
          exitCode: code,
          stdout: stdoutStr,
          stderr: stderrStr,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
      });

      // 处理错误
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        console.error(`[Runner] Job ${target.id} failed to start:`, error.message);

        resolve({
          success: false,
          targetId: target.id,
          durationMs,
          exitCode: null,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          error: error.message,
        });
      });
    });
  }

  /**
   * 获取 skill 目录路径
   * Get skill directory path
   */
  private getSkillPath(sourceType: string): string {
    // 标准化 source_type 到目录名映射
    const dirName = `${sourceType}_skill`;
    return resolve(this.config.crawlersBasePath, dirName);
  }

  /**
   * 检查文件是否存在
   * Check if file exists
   */
  private fileExists(path: string): boolean {
    try {
      const { accessSync } = require('fs');
      accessSync(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建错误结果
   * Create error result
   */
  private createErrorResult(
    targetId: number,
    startTime: number,
    error: string
  ): JobExecutionResult {
    return {
      success: false,
      targetId,
      durationMs: Date.now() - startTime,
      exitCode: null,
      stdout: '',
      stderr: '',
      error,
    };
  }
}

export default JobRunner;
