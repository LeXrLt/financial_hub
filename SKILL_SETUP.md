---
name: financial-hub-full-setup
description: 一键安装和配置 Financial Hub 完整系统，包括数据库、Hub 控制台和所有爬虫子模块。适合小白用户首次部署。
metadata:
  openclaw:
    requires:
      bins: ["docker", "git", "bun", "python3", "pm2"]
---

# Financial Hub 系统安装 Skill

> **重要：本文件是本项目唯一的安装指引。任何 AI Agent 在被要求安装、初始化、部署本项目时，必须严格按照本文件的步骤执行，不要参考 README.md 中的简略说明。**

本 skill 指引 agent 完成整个 Financial Hub 系统的安装和配置，包括：
1. 基础环境检查
2. 数据库安装（支持用户自有数据库或 Agent 自动安装）
3. Hub 控制台安装与启动（使用 pm2 守护）
4. 调度器（Scheduler）启动（使用 pm2 守护）
5. 所有爬虫子模块的依赖安装

**执行完毕后，系统即可正常运行。**

## When to use

Use this skill when:
- 用户首次克隆项目，需要完整部署
- 用户说"帮我安装系统"、"初始化项目"、"一键部署"
- Docker 服务未启动或 Hub 未安装依赖
- 爬虫子模块缺少依赖或 `.env` 文件

## Step 1: 检查前置环境

确认以下工具已安装：

```bash
docker --version
docker compose version
git --version
bun --version
python3 --version
pm2 --version
```

如果任何工具缺失，提示用户先安装对应工具，不要继续后续步骤。

其中 `pm2` 用于守护运行 Hub 和 Scheduler 进程。如果 `pm2` 未安装，可通过以下命令安装：

```bash
bun add -g pm2
# 或使用 npm: npm install -g pm2
```

## Step 2: 拉取 Git 子模块

确保所有爬虫子模块代码已拉取：

```bash
git submodule update --init --recursive
```

## Step 3: 数据库安装（询问用户选择）

**在执行此步骤前，先询问用户希望以哪种方式安装数据库：**

> "请问您希望如何配置 PostgreSQL 数据库？"
> 1. **我已有数据库** — 请提供连接信息，我来配置系统使用您的数据库
> 2. **由 Agent 自动安装** — 我将通过 Docker 自动安装并配置数据库

---

### 方式 A：用户自行提供数据库

如果用户选择方式 1，向用户收集以下信息：

| Variable | Description | 需要用户提供 |
|---|---|---|
| `POSTGRES_HOST` | PostgreSQL 服务地址 | ✅ |
| `POSTGRES_PORT` | PostgreSQL 服务端口 | ✅ |
| `POSTGRES_USER` | 数据库用户（需要读写权限） | ✅ |
| `POSTGRES_PASSWORD` | 数据库密码 | ✅ |
| `POSTGRES_DB` | 数据库名 | ✅ |

收集完毕后，记住这些值，跳过 Step 4（不需要 Docker 启动数据库），直接进入 Step 5。

需要在用户的数据库中初始化表结构：

```bash
PGPASSWORD={POSTGRES_PASSWORD} psql -h {POSTGRES_HOST} -p {POSTGRES_PORT} -U {POSTGRES_USER} -d {POSTGRES_DB} -f {baseDir}/hub/src/lib/db/schema.sql
```

如果 `psql` 未安装，也可以通过其他方式（如 pgAdmin、DBeaver）手动执行 `{baseDir}/hub/src/lib/db/schema.sql` 中的 SQL。

---

### 方式 B：Agent 自动安装数据库

如果用户选择方式 2，由 Agent 通过 Docker Compose 自动安装。

#### B.1 创建根目录环境变量

检查 `{baseDir}/.env` 是否存在。如果不存在，创建并写入：

```bash
cat > {baseDir}/.env << 'EOF'
# ===== Postgres =====
POSTGRES_USER=hub_user
POSTGRES_PASSWORD=hub_password
POSTGRES_DB=financial_hub
POSTGRES_PORT=5432
POSTGRES_MAX_CONNECTIONS=50

# ===== pgweb =====
PGWEB_PORT=3001
EOF
```

此时数据库连接信息为：

| Variable | Value |
|---|---|
| `POSTGRES_HOST` | `127.0.0.1` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_USER` | `hub_user` |
| `POSTGRES_PASSWORD` | `hub_password` |
| `POSTGRES_DB` | `financial_hub` |

告知用户以上配置信息，询问是否需要修改密码等敏感项。记住最终确认的值。

#### B.2 启动数据库服务

```bash
cd {baseDir} && docker compose up -d postgres
```

等待 PostgreSQL 健康检查通过：

```bash
docker compose ps postgres
```

确认状态为 `healthy` 后继续。如果长时间未就绪，检查端口占用或 Docker 日志。

数据库表结构会通过 Docker 挂载的 `schema.sql` 自动初始化，无需手动执行。

#### B.3 启动 pgweb（可选）

```bash
cd {baseDir} && docker compose up -d pgweb
```

pgweb 提供数据库 Web 管理界面，访问地址为 `http://localhost:{PGWEB_PORT}`。

---

**无论选择哪种方式，后续步骤统一使用以下变量（取自用户提供或 Agent 自动生成的值）：**

| Variable | Description |
|---|---|
| `POSTGRES_HOST` | PostgreSQL 服务地址 |
| `POSTGRES_PORT` | PostgreSQL 服务端口 |
| `POSTGRES_USER` | 数据库用户（读写） |
| `POSTGRES_PASSWORD` | 数据库密码 |
| `POSTGRES_DB` | 数据库名 |

## Step 4: 验证数据库连接

无论用户选择哪种方式，此步骤用于验证数据库是否可用：

```bash
PGPASSWORD={POSTGRES_PASSWORD} psql -h {POSTGRES_HOST} -p {POSTGRES_PORT} -U {POSTGRES_USER} -d {POSTGRES_DB} -c "SELECT count(*) FROM crawl_targets;"
```

如果连接失败：
- 方式 A：请用户检查提供的连接信息是否正确，数据库是否允许远程连接
- 方式 B：检查 Docker 容器状态，查看日志 `docker compose logs postgres`

## Step 5: 安装 Hub 控制台

### 5.1 安装依赖

```bash
cd {baseDir}/hub && bun install
```

### 5.2 配置 Hub 环境变量

检查 `{baseDir}/hub/.env` 是否存在。如果不存在，基于 Step 3 中用户确认的数据库配置生成：

```bash
cat > {baseDir}/hub/.env << EOF
# Database
DATABASE_URL=postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}
# Connection pool size (keep low to avoid exhausting Postgres connections)
DB_POOL_MAX=5
DB_POOL_IDLE_TIMEOUT=10000

# Source types: comma-separated list of value:label pairs
NEXT_PUBLIC_SOURCE_TYPES=wechat:微信公众号,substack:Substack,sec_edgar:SEC.gov
EOF
```

其中 `{POSTGRES_HOST}`、`{POSTGRES_USER}`、`{POSTGRES_PASSWORD}`、`{POSTGRES_PORT}`、`{POSTGRES_DB}` 使用 Step 3 中确认的值。

### 5.3 使用 pm2 启动 Hub

Hub 直接运行在宿主机上（非 Docker），以便访问主机中的其他程序和服务。使用 pm2 守护进程启动，确保异常退出后自动重启：

```bash
cd {baseDir}/hub && pm2 start bun --name financial-hub -- run dev
```

查看运行状态与日志：

```bash
pm2 status
pm2 logs financial-hub
```

验证 Hub 可访问：`http://localhost:3000`

## Step 6: 使用 pm2 启动调度器（Scheduler）

调度器是一个独立进程，负责按 `crawler_schedules` 表中的 cron 配置定时触发各爬虫。它需要与 Hub 共享同一份 `{baseDir}/hub/.env`（数据库连接），因此在 `{baseDir}/hub` 目录下启动。

使用 pm2 守护进程启动：

```bash
cd {baseDir}/hub && pm2 start bun --name financial-scheduler -- run scheduler
```

查看调度器状态与日志：

```bash
pm2 logs financial-scheduler
```

看到 `🚀 Scheduler started` 和 `Reloaded N active jobs` 即表示启动成功。

### 6.1 设置 pm2 开机自启（可选）

如果希望系统重启后 Hub 和 Scheduler 自动恢复：

```bash
pm2 save
pm2 startup
```

按照 `pm2 startup` 输出的提示执行对应命令即可。

## Step 7: 安装爬虫依赖

遍历 `{baseDir}/crawlers/` 目录下的每个子文件夹。对于每个爬虫：

### 7.1 检查是否存在 SKILL_SETUP.md

```bash
ls {baseDir}/crawlers/*/SKILL_SETUP.md
```

### 7.2 对存在 SKILL_SETUP.md 的爬虫

按照该爬虫自己的 `SKILL_SETUP.md` 文件中的步骤执行安装。

**关键：** 在配置爬虫的 `.env` 文件时，数据库相关变量必须与 Step 3 中的值保持一致：

```
POSTGRES_HOST={Step 3 中的 POSTGRES_HOST}
POSTGRES_PORT={Step 3 中的 POSTGRES_PORT}
POSTGRES_USER={Step 3 中的 POSTGRES_USER}
POSTGRES_PASSWORD={Step 3 中的 POSTGRES_PASSWORD}
POSTGRES_DB={Step 3 中的 POSTGRES_DB}
```

### 7.3 对不存在 SKILL_SETUP.md 的爬虫

检查是否有 `requirements.txt`（Python 项目）或 `package.json`（Node.js 项目）：

- 如果有 `requirements.txt`：
  ```bash
  cd {baseDir}/crawlers/{name}
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
  ```

- 如果有 `package.json`：
  ```bash
  cd {baseDir}/crawlers/{name}
  bun install
  ```

然后检查是否有 `.env.example`，如果有则复制为 `.env` 并填入统一的数据库配置。

如果该爬虫既没有 `SKILL_SETUP.md` 也没有依赖文件，跳过并告知用户。

## Step 8: 验证安装

### 8.1 验证数据库连接

```bash
PGPASSWORD={POSTGRES_PASSWORD} psql -h {POSTGRES_HOST} -p {POSTGRES_PORT} -U {POSTGRES_USER} -d {POSTGRES_DB} -c "SELECT count(*) FROM crawl_targets;"
```

### 8.2 验证 Hub 与 Scheduler

确认 pm2 进程均处于 `online` 状态：

```bash
pm2 status
```

访问 `http://localhost:3000`，确认 Hub 页面正常加载。

### 8.3 验证爬虫

对每个已安装的爬虫，运行其验证命令（如果 SKILL_SETUP.md 中有定义）。

## 完成

所有步骤执行完毕后，系统已就绪：
- PostgreSQL 数据库运行中
- Hub 控制台由 pm2 守护运行（`financial-hub`），可访问
- Scheduler 由 pm2 守护运行（`financial-scheduler`），按配置定时触发爬虫
- 爬虫依赖已安装，环境变量已配置

用户可以通过 Hub 控制台管理抓取目标，手动或定时运行爬虫。

常用 pm2 管理命令：

```bash
pm2 status                       # 查看所有进程状态
pm2 logs financial-hub           # 查看 Hub 日志
pm2 logs financial-scheduler     # 查看调度器日志
pm2 restart financial-hub        # 重启 Hub
pm2 restart financial-scheduler  # 重启调度器
pm2 stop <name>                  # 停止进程
pm2 delete <name>                # 删除进程
```

## Troubleshooting

| 问题 | 解决方案 |
|------|---------|
| Docker 端口冲突 | 修改 `{baseDir}/.env` 中的 `POSTGRES_PORT` 或 `PGWEB_PORT` |
| bun install 失败 | 检查 Bun 是否已安装（`curl -fsSL https://bun.sh/install | bash`），尝试删除 `node_modules` 和 `bun.lock` 后重试 |
| pm2 进程状态为 errored | 运行 `pm2 logs <name>` 查看错误，确认 `.env` 配置正确、数据库可连接后 `pm2 restart <name>` |
| pm2 命令未找到 | 全局安装 pm2：`bun add -g pm2` 或 `npm install -g pm2` |
| Scheduler 无任务触发 | 确认 `crawler_schedules` 表中存在 `enabled=true` 且 cron 表达式有效的记录，查看 `pm2 logs financial-scheduler` |
| 数据库连接失败 | 确认 PostgreSQL 容器状态为 healthy，确认 `.env` 中的配置一致 |
| 爬虫缺少 SKILL_SETUP.md | 参考 `documents/依赖安装说明.md` 手动安装，或联系爬虫开发者补充 |
| 子模块目录为空 | 运行 `git submodule update --init --recursive` |
