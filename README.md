# Financial Hub — 信息抓取与 AI Agent 资料库系统

抓取多种来源的金融信息，保存到本地数据库和 NAS，供 AI Agent 后续读取、检索、总结和分析。

## 系统架构

```
数据来源 (微信公众号 / YouTube / 小宇宙播客 / Substack ...)
  ↓
定时爬虫 (crawlers/)
  ↓
PostgreSQL + NAS
  ↓
Hub 控制台 (hub/)          ← 管理抓取目标、查看运行状态
  ↓
Agent Skill               ← 给 AI Agent 提供数据读取能力
  ↓
AI Agent
```

### 组件职责

| 组件 | 说明 |
|------|------|
| **Hub** | Next.js 管理控制台，直接运行在宿主机上，管理抓取目标、查看运行日志和组件健康状态 |
| **Crawlers** | 各数据来源的独立爬虫，通过 git submodule 管理 |
| **PostgreSQL** | 保存结构化数据、正文、transcript、文件路径、metadata、raw_data |
| **NAS** | 保存图片、视频、音频等文件本体，数据库中只保存路径 |
| **pgweb** | 数据库 Web 管理界面 |

### 目录结构

```
financial_hub/
├── hub/                    # Next.js 管理控制台（宿主机运行）
│   ├── src/
│   │   ├── app/            # 页面和 API 路由
│   │   └── lib/            # 数据库连接、schema
│   └── .env.example
├── crawlers/               # 爬虫子模块目录
│   └── substack_skill/     # Substack 爬虫 (git submodule)
├── documents/              # 系统设计文档
├── docker-compose.yml
└── README.md
```

### 数据库表

| 表名 | 功能 |
|------|------|
| `crawl_targets` | 抓取目标管理（来源类型、标识、cron 频率、状态） |
| `crawl_runs` | 每次爬虫运行的详细日志 |
| `component_status` | 各组件（爬虫、转录器）健康状态 |
| `system_events` | 系统事件审计日志 |
| `data_stats` | 各数据表统计快照 |

详细表结构见 [documents/数据库表说明.md](documents/数据库表说明.md)。

## 安装与启动

### 前置要求

- Docker & Docker Compose（用于运行 PostgreSQL 和 pgweb）
- Node.js >= 20（用于运行 Hub）
- Git（用于拉取 submodule）
- Python 3（用于运行爬虫）

### 1. 克隆仓库

```bash
git clone --recurse-submodules <repo-url>
cd financial_hub
```

> 如果已经克隆但未拉取子模块：
> ```bash
> git submodule update --init --recursive
> ```

### 2. 配置环境变量

根目录 `.env` 用于 Docker Compose（数据库配置），复制示例：

```bash
cp .env.example .env
```

Hub 的环境变量单独配置：

```bash
cp hub/.env.example hub/.env
```

根据需要修改数据库连接等配置，确保两处的数据库用户名、密码、库名保持一致。

### 3. 启动数据库服务

```bash
docker compose up -d
```

### 4. 启动 Hub 控制台

Hub 直接运行在宿主机上（非 Docker），以便访问主机中的其他程序和服务：

```bash
cd hub
npm install
npm run dev
```

启动后可访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| Hub 控制台 | http://localhost:3000 | 管理抓取目标、查看运行状态 |
| pgweb | http://localhost:3001 | 数据库 Web 管理界面 |
| PostgreSQL | localhost:5432 | 数据库直连（用户: `hub_user`） |

### 5. 停止服务

```bash
# 停止 Hub（Ctrl+C 终止 npm run dev）
# 停止数据库
docker compose down
```

> 数据库数据保存在 Docker volume `postgres_data` 中，停止服务不会丢失数据。
> 如需清除数据：`docker compose down -v`

## 配置说明

### 数据来源类型

数据来源列表通过环境变量 `NEXT_PUBLIC_SOURCE_TYPES` 配置，格式为逗号分隔的 `value:label` 对：

```
NEXT_PUBLIC_SOURCE_TYPES=wechat:微信公众号,youtube:YouTube,xiaoyuzhou:小宇宙播客,substack:Substack
```

修改 `hub/.env` 中的值，重启 Hub 即可生效。

### 数据库连接池

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `DB_POOL_MAX` | `5` | 最大连接数 |
| `DB_POOL_IDLE_TIMEOUT` | `10000` | 空闲连接超时（毫秒） |

PostgreSQL `max_connections = 50`，Hub 占用 5 个，其余留给爬虫、pgweb 等服务。

## 爬虫子模块

爬虫以 git submodule 形式管理，存放在 `crawlers/` 目录下。

### 添加新爬虫

```bash
git submodule add <repo-url> crawlers/<name>
```

### 当前子模块

| 子模块 | 仓库 |
|--------|------|
| `crawlers/substack_skill` | https://github.com/LeXrLt/substack_skill.git |
| `crawlers/by_luzhe` | https://github.com/lugit123456/skills.git |
| `crawlers/sec_skill` | https://github.com/LeXrLt/sec_skill.git |

### 更新子模块

```bash
git submodule update --remote --merge
```

## 注意事项

1. **不要将 `.env` 提交到 Git**，其中可能包含敏感信息，已在 `.gitignore` 中排除
2. **Hub 运行在宿主机上**，不使用 Docker，以便访问主机中的其他程序和服务
3. **数据库 schema 变更**后需重新初始化：先 `docker compose down -v` 清除旧数据，再 `docker compose up -d`
4. **每种数据来源单独建表**，不强行统一字段，各来源按自身真实结构建模
5. **克隆仓库时**务必加 `--recurse-submodules`，否则 `crawlers/` 下的子模块内容为空
