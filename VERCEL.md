# Vercel 部署指南

本指南将帮助您将 Notion 到 iCalendar 同步工具部署到 Vercel 平台。

## 前提条件

1. GitHub 账号
2. Vercel 账号（可以使用 GitHub 账号登录）
3. Notion API 密钥和数据库 ID

## 部署步骤

### 1. Fork 或克隆此仓库到您的 GitHub 账号

在 GitHub 上访问此仓库，点击 "Fork" 按钮创建您自己的副本。

### 2. 连接到 Vercel

1. 登录 [Vercel](https://vercel.com/)
2. 点击 "New Project"
3. 在 "Import Git Repository" 区域，找到并选择您刚刚 fork 的仓库
4. 点击 "Import"

### 3. 配置环境变量

在部署配置页面，添加以下环境变量：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `NOTION_API_KEY` | 是 | 您的 Notion API 密钥 |
| `NOTION_DATABASE_ID` | 是 | 您的 Notion 数据库 ID |
| `TITLE_PROPERTY` | 否 | Notion 数据库中标题字段名（默认："Name"） |
| `START_DATE_PROPERTY` | 否 | Notion 数据库中开始日期字段名（默认："日期"） |
| `END_DATE_PROPERTY` | 否 | Notion 数据库中结束日期字段名（默认："截止日期"） |
| `DESCRIPTION_PROPERTY` | 否 | Notion 数据库中描述字段名（默认："备注"） |
| `LOCATION_PROPERTY` | 否 | Notion 数据库中地点字段名（默认："地点"） |
| `CALENDAR_NAME` | 否 | 日历名称（默认："我的 Notion 日历"） |
| `CALENDAR_DESCRIPTION` | 否 | 日历描述（默认："从 Notion 数据库自动同步的日历"） |

### 4. 部署

完成环境变量配置后，点击 "Deploy" 按钮开始部署。

部署完成后，Vercel 会提供一个域名（通常是 `your-project-name.vercel.app`）。

## 使用您的日历

### 在日历应用中订阅

1. 打开您的日历应用（如 macOS 日历、Google 日历等）
2. 选择添加订阅日历选项
3. 输入 URL：`https://your-project-name.vercel.app/calendar.ics`
4. 根据需要配置自动刷新选项（建议设置为"每小时"）

### 手动刷新

要立即刷新日历数据，访问：
`https://your-project-name.vercel.app/sync`

### 查看状态

要查看同步状态，访问：
`https://your-project-name.vercel.app/status`

## 关于 Vercel 部署的说明

1. **无服务器架构**：Vercel 使用无服务器架构，这意味着我们的服务不会一直运行，而是在收到请求时才启动。

2. **数据缓存**：由于无服务器函数的限制，数据会在函数执行之间丢失。这就是为什么我们使用定时触发器来保持数据更新。

3. **定时同步**：Vercel 的 Cron Jobs 功能将每 30 分钟触发一次 `/sync` 端点，确保日历数据保持最新。

4. **冷启动延迟**：首次访问可能会有轻微延迟，这是由于函数需要"冷启动"。后续请求通常会更快。

## 高级配置

如果您需要更改定时同步频率，可以修改 `vercel.json` 文件中的 cron 表达式:

```json
"crons": [
  {
    "path": "/api/sync.py",
    "schedule": "*/30 * * * *"  // 每30分钟执行一次
  }
]
```

## 升级

当此项目有更新时，您可以：

1. 将最新代码拉取到您的 fork
2. Vercel 将自动检测更改并重新部署

或者，您可以在 Vercel 仪表板中手动触发重新部署。

## 故障排除

如果您遇到问题：

1. **日历为空**：检查您的 Notion API 密钥和数据库 ID 是否正确
2. **同步失败**：访问 `/status` 端点查看状态信息
3. **日历无法订阅**：确保您正确输入了完整的日历 URL 