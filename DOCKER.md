# Docker 部署指南

本指南将帮助您使用 Docker 部署 Notion 到 iCalendar 同步工具。

## 前提条件

- Docker 已安装
- Docker Compose 已安装
- Notion API 密钥和数据库 ID (参见 `INSTALL.md` 中的步骤 1-3)

## 快速部署步骤

### 1. 准备环境变量

复制示例环境变量文件并修改：

```bash
cp env.example .env
```

编辑 `.env` 文件，至少填写以下必要信息：

```
# Notion API 凭证
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here

# 应用配置 (可选自定义)
PORT=5000
HOST=0.0.0.0
```

### 2. 使用 Docker Compose 构建并启动

**标准版本** (默认)

```bash
docker-compose up -d
```

**超轻量级版本** (更节省资源)

```bash
docker-compose -f docker-compose.alpine.yml up -d
```

此命令将构建 Docker 镜像并在后台启动服务。服务将在您指定的端口上运行（默认为 5000）。

### 3. 验证服务运行状态

访问 Web 界面查看服务状态：

```
http://localhost:5000
```

或者查看容器日志：

```bash
docker-compose logs -f
```

### 4. 在日历应用中订阅

按照 `INSTALL.md` 中的第 7 步，将生成的 iCalendar URL 添加到您的日历应用中。

## 环境变量配置

您可以通过修改 `.env` 文件来自定义以下配置：

```
# Notion API 凭证 (必填)
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here

# 应用配置
PORT=5000                  # 容器外部访问端口
HOST=0.0.0.0               # 监听地址
DEBUG=False                # 调试模式
SYNC_INTERVAL=60           # 同步间隔（分钟）

# 日历配置
CALENDAR_NAME=我的 Notion 日历
CALENDAR_DESCRIPTION=从 Notion 数据库自动同步的日历

# Notion 字段映射 (根据您的数据库结构修改)
TITLE_PROPERTY=Name
START_DATE_PROPERTY=日期
END_DATE_PROPERTY=截止日期
DESCRIPTION_PROPERTY=备注
LOCATION_PROPERTY=地点
```

## 关于镜像版本

项目提供了两种镜像版本选择：

1. **标准版本** (docker-compose.yml)
   - 使用标准Python镜像构建
   - 内存限制：200MB
   - 适合大多数环境

2. **超轻量级版本** (docker-compose.alpine.yml)
   - 基于Alpine构建的最小化镜像
   - 内存限制：150MB
   - 更加节省资源
   - 适合资源受限环境

根据您的需求选择合适的版本。对于多数用户，超轻量级版本是推荐选择。

## 资源限制

Docker 配置已经设置了资源限制，确保容器不会占用过多系统资源。您可以根据需要在 `docker-compose.yml` 文件中调整这些值。

## 数据持久化

日历数据存储在 Docker 卷 `notion_calendar_data` 中，确保容器重启后数据不会丢失。

## 管理容器

### 停止服务

```bash
docker-compose stop
```

或对于轻量级版本：

```bash
docker-compose -f docker-compose.alpine.yml stop
```

### 重启服务

```bash
docker-compose restart
```

### 完全删除服务和数据

```bash
docker-compose down -v
```

### 查看日志

```bash
docker-compose logs -f
```

### 手动触发同步

```bash
curl http://localhost:5000/sync
```

## 升级

要升级到新版本：

1. 拉取最新代码
2. 重新构建并重启容器

```bash
git pull
docker-compose up -d --build
```

或对于轻量级版本：

```bash
git pull
docker-compose -f docker-compose.alpine.yml up -d --build
```

## 故障排除

1. **容器无法启动**
   - 检查日志: `docker-compose logs -f`
   - 确认环境变量设置正确
   - 验证所有需要的端口未被占用

2. **无法访问 Web 界面**
   - 确认容器正在运行: `docker ps`
   - 检查端口映射是否正确
   - 尝试使用容器 ID 直接访问: `docker exec -it container_id curl http://localhost:5000`

3. **日历为空**
   - 按照 `INSTALL.md` 中的步骤检查您的 Notion API 配置
   - 通过日志检查是否有同步错误 