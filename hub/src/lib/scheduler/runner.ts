/**
 * 任务执行器 - 负责执行单个抓取任务
 * Job Runner - Executes crawl jobs by source_type
 */

import { spawn } from 'child_process';
import { resolve, join } from 'path';
import { JobExecutionResult, SchedulerConfig } from './types';

// 默认配置
const DEFAULT_CONFIG: Partial<SchedulerConfig> = {
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
   * 执行爬虫任务（按 source_type）
   * Execute a crawl job by source_type
   */
  async runBySourceType(sourceType: string): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const skillPath = this.getSkillPath(sourceType);
    const entryScript = this.getEntryScript(sourceType);
    const venvPython = join(skillPath, '.venv', 'bin', 'python');
    const mainScript = join(skillPath, entryScript);

    // 检查必要文件是否存在
    if (!this.fileExists(venvPython)) {
      return this.createErrorResult(
        sourceType,
        startTime,
        `Virtual environment not found: ${venvPython}`
      );
    }

    if (!this.fileExists(mainScript)) {
      return this.createErrorResult(
        sourceType,
        startTime,
        `Entry script not found: ${mainScript}`
      );
    }

    return new Promise((resolve) => {
      // 不传递参数，让 skill 自行查询所有 enabled 目标
      const args: string[] = [];
      const stdout: string[] = [];
      const stderr: string[] = [];

      // 计算该爬虫的下载目录：下载根目录 + source_type
      // 在 DOWNLOAD_ROOT 后拼接 source_type，作为子爬虫的下载根目录传入
      const downloadRoot = process.env.DOWNLOAD_ROOT;
      const crawlerOutputDir = downloadRoot
        ? join(downloadRoot, sourceType)
        : undefined;

      console.log(`[Runner] Starting job for ${sourceType}`);
      console.log(`[Runner] Command: ${venvPython} ${entryScript} ${args.join(' ')}`);
      console.log(`[Runner] Working directory: ${skillPath}`);
      if (crawlerOutputDir) {
        console.log(`[Runner] Crawler output dir: ${crawlerOutputDir}`);
      }

      const child = spawn(venvPython, [entryScript, ...args], {
        cwd: skillPath,
        env: {
          ...process.env,
          // 确保 skill 能连接到正确的数据库
          POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
          POSTGRES_PORT: process.env.POSTGRES_PORT || '5432',
          POSTGRES_DB: process.env.POSTGRES_DB || 'financial_hub',
          POSTGRES_USER: process.env.POSTGRES_USER || 'hub',
          POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || '',
          // 下载根目录（DOWNLOAD_ROOT/<source_type>），由各 skill 读取
          ...(crawlerOutputDir ? { CRAWLER_OUTPUT_DIR: crawlerOutputDir } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 收集输出
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout.push(chunk);
        // 实时输出到控制台（便于调试）
        process.stdout.write(`[Job ${sourceType}] ${chunk}`);
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr.push(chunk);
        process.stderr.write(`[Job ${sourceType} stderr] ${chunk}`);
      });

      // 不设置超时：任务实际运行时间可能很长，由调度器保证同一 source_type 同一时间只运行一个实例

      // 处理退出
      child.on('exit', (code, signal) => {
        const durationMs = Date.now() - startTime;
        const stdoutStr = stdout.join('');
        const stderrStr = stderr.join('');

        console.log(`[Runner] Job ${sourceType} exited with code ${code}, signal ${signal}`);

        resolve({
          success: code === 0,
          sourceType,
          durationMs,
          exitCode: code,
          stdout: stdoutStr,
          stderr: stderrStr,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
      });

      // 处理错误
      child.on('error', (error) => {
        const durationMs = Date.now() - startTime;

        console.error(`[Runner] Job ${sourceType} failed to start:`, error.message);

        resolve({
          success: false,
          sourceType,
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
   * source_type 到爬虫目录/入口脚本的自定义映射
   * 格式：{ sourceType: { dir: '相对于 crawlersBasePath 的路径', script: '入口脚本名' } }
   * 未配置的 source_type 使用默认规则：{sourceType}_skill/main.py
   */
  private static readonly CRAWLER_MAP: Record<string, { dir: string; script?: string }> = {
    wechat: { dir: 'by_luzhe/wechat_reptile', script: 'scheduler_skill.py' },
    sec_edgar: { dir: 'sec_skill', script: 'main.py' },
    // reddit: { dir: 'reddit_skill', script: 'main.py' },  // 目录尚未存在
  };

  /**
   * 获取 skill 目录路径和入口脚本
   * Get skill directory path and entry script
   */
  private getSkillPath(sourceType: string): string {
    const mapping = JobRunner.CRAWLER_MAP[sourceType];
    if (mapping) {
      return resolve(this.config.crawlersBasePath, mapping.dir);
    }
    // 默认规则：{sourceType}_skill
    return resolve(this.config.crawlersBasePath, `${sourceType}_skill`);
  }

  /**
   * 获取入口脚本名
   */
  private getEntryScript(sourceType: string): string {
    return JobRunner.CRAWLER_MAP[sourceType]?.script || 'main.py';
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
    sourceType: string,
    startTime: number,
    error: string
  ): JobExecutionResult {
    return {
      success: false,
      sourceType,
      durationMs: Date.now() - startTime,
      exitCode: null,
      stdout: '',
      stderr: '',
      error,
    };
  }
}

export default JobRunner;
