# Notion 到 iCalendar 同步工具

这个工具可以将 Notion 数据库中的日程安排自动同步到 iCalendar (.ics) 文件，并提供一个可访问的 URL，方便与 macOS 日历程序或其他日历应用集成。

## 功能特点

- 从 Notion 数据库获取日程安排
- 自动转换为 iCalendar 格式
- 提供在线访问的 iCalendar URL
- 定时自动同步更新
- 可配置的事件字段映射

## 部署选项

### 方式一：Vercel 一键部署 (推荐)

最简单的部署方式，无需服务器，直接使用 Vercel 免费托管:

1. Fork 此项目到您的 GitHub 账户
2. 导入到 Vercel 并配置环境变量
3. 完成部署，获取日历 URL

详细步骤请参阅 [VERCEL.md](VERCEL.md)

### 方式二：Docker 部署

适合希望自托管的用户:

1. 复制 `env.example` 到 `.env` 并填写必要信息
2. 运行 `docker-compose up -d` 启动服务

详细步骤请参阅 [DOCKER.md](DOCKER.md)

### 方式三：直接安装

适合熟悉 Python 的用户:

1. 克隆此仓库
2. 安装依赖: `pip install -r requirements.txt`
3. 复制 `env.example` 到 `.env` 并填写您的 Notion API 密钥和数据库 ID
4. 运行应用: `python app.py`

详细步骤请参阅 [INSTALL.md](INSTALL.md)

## 配置说明

在 `.env` 文件中配置:

```
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id
SYNC_INTERVAL=60  # 同步间隔，单位为分钟
PORT=5000  # Web 服务端口
```

## 在 macOS 日历中使用

1. 打开 macOS 日历应用
2. 选择"文件" > "新建日历订阅"
3. 输入 URL: `http://your-server-address:5000/calendar.ics` 或 Vercel 提供的 URL
4. 根据需要配置自动刷新选项

## 部署建议

对于持续运行:
- Docker 容器（最简单方法，参见 [DOCKER.md](DOCKER.md)）
- 使用 systemd 服务 (Linux)
- 使用 launchd 服务 (macOS)
- 或部署到云服务如 Heroku, AWS 等 