# Financial Hub - 抓取系统监控面板

基于 Next.js 前后端一体架构的抓取系统监控面板，用于管理抓取目标和查看各组件运行状态。

## 功能

- **Dashboard** - 总览数据统计、组件健康状态、最近运行记录
- **抓取目标管理** - 添加/启用/停用抓取目标，支持 wechat、youtube、xiaoyuzhou
- **运行日志** - 查看所有爬虫运行历史、耗时、成功/失败状态
- **组件心跳** - 各 Crawler 通过 API 上报健康状态

## 技术栈

- **Next.js 14** - 前后端一体，App Router
- **PostgreSQL 16** - 数据存储
- **TailwindCSS** - 样式
- **Lucide React** - 图标
- **pg** - Node.js Postgres 驱动（连接池）
- **Docker Compose** - 一键部署

## 快速开始

### Docker 一键部署

```bash
cd /path/to/financial_hub
docker compose up -d
```

启动后访问 http://localhost:3000

### 本地开发

```bash
cd hub
bun install
cp .env.example .env.local
# 修改 .env.local 中的 DATABASE_URL
bun run dev
```

### 数据库迁移

容器首次启动时会自动执行 `schema.sql` 初始化表结构。

手动迁移：

```bash
cd hub
DATABASE_URL=postgresql://hub_user:hub_password@localhost:5432/financial_hub bun run db:migrate
```

## API 接口

供 Crawler 调用的接口：

### 组件心跳上报

```
POST /api/components
Body: { "component_name": "wechat_crawler", "status": "healthy", "metadata": {} }
```

### 上报运行记录

```
POST /api/runs
Body: { "target_id": 1, "status": "success", "items_found": 10, "items_new": 3, "items_failed": 0, "duration_ms": 5200 }
```

### 抓取目标 CRUD

```
GET    /api/targets         - 获取所有目标
POST   /api/targets         - 创建目标
PATCH  /api/targets/:id     - 更新目标
DELETE /api/targets/:id     - 删除目标
GET    /api/targets/:id/toggle - 切换启用/停用
```

## 连接池配置

为避免数据库连接数过多：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| DB_POOL_MAX | 5 | 连接池最大连接数 |
| DB_POOL_IDLE_TIMEOUT | 10000 | 空闲连接超时(ms) |

Postgres 侧配置 `max_connections=50`，Hub 应用连接池最大 5 个连接，为 Crawler 和其他服务预留足够连接数。

## 项目结构

```
hub/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard
│   │   ├── layout.tsx            # 布局
│   │   ├── globals.css           # 全局样式
│   │   ├── targets/
│   │   │   ├── page.tsx          # 抓取目标列表
│   │   │   └── new/page.tsx      # 添加目标表单
│   │   ├── runs/
│   │   │   └── page.tsx          # 运行日志
│   │   └── api/
│   │       ├── targets/          # 目标 CRUD API
│   │       ├── components/       # 组件心跳 API
│   │       └── runs/             # 运行记录 API
│   └── lib/
│       └── db/
│           ├── pool.ts           # 连接池（限制 max=5）
│           ├── query.ts          # 查询封装 + 慢查询日志
│           ├── schema.sql        # 数据库表结构
│           └── migrate.js        # 迁移脚本
├── Dockerfile
├── package.json
└── .env.example
```
