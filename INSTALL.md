# Notion 到 iCalendar 同步工具安装指南

本指南将帮助您设置 Notion 到 iCalendar 的同步工具，实现 Notion 数据库与 macOS 日历的自动同步。

## 前提条件

1. Python 3.7 或更高版本
2. Notion 账户和 API 密钥
3. 一个已设置好的 Notion 数据库，包含日程安排

## 步骤 1: 获取 Notion API 密钥

1. 访问 [Notion Developers](https://developers.notion.com/)
2. 点击 "My integrations" 并登录您的 Notion 账户
3. 点击 "New integration"，填写名称，选择工作区
4. 创建后，您将获得一个 "Internal Integration Token"，这就是您的 API 密钥

## 步骤 2: 获取数据库 ID

1. 在 Notion 中打开您的日程安排数据库
2. 在浏览器地址栏中找到形如 `https://www.notion.so/workspace/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX?v=...` 的 URL
3. 其中 `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` 部分就是您的数据库 ID

## 步骤 3: 授权集成访问数据库

1. 在 Notion 中打开您的数据库页面
2. 点击右上角的 "•••" (共享按钮)
3. 点击 "Connections" 并找到您刚创建的集成名称
4. 勾选该集成以授权其访问此数据库

## 步骤 4: 安装和配置同步工具

1. 克隆或下载本仓库

```bash
git clone https://github.com/yourusername/notion2ics.git
cd notion2ics
```

2. 安装依赖

```bash
pip install -r requirements.txt
```

3. 创建并编辑 `.env` 文件

```bash
cp env.example .env
```

然后编辑 `.env` 文件，填写您的 Notion API 密钥和数据库 ID：

```
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here
```

4. 调整字段映射（如有必要）

如果您的 Notion 数据库使用了不同的字段名称，请在 `.env` 文件中相应地更新它们：

```
TITLE_PROPERTY=您的标题字段名
START_DATE_PROPERTY=您的开始日期字段名
END_DATE_PROPERTY=您的结束日期字段名
DESCRIPTION_PROPERTY=您的描述字段名
LOCATION_PROPERTY=您的地点字段名
```

## 步骤 5: 运行应用

测试运行应用程序：

```bash
python app.py
```

访问 http://localhost:5000 查看 Web 界面。

## 步骤 6: 设置为 macOS 启动服务（可选）

1. 编辑 `com.notion2ics.plist.example` 文件，更新路径：

```xml
<string>/usr/bin/python3</string>
<string>/实际路径/app.py</string>
```

并更新日志路径和工作目录：

```xml
<string>/Users/您的用户名/Library/Logs/notion2ics.log</string>
<string>/实际路径/notion2ics</string>
```

2. 将文件复制到 `~/Library/LaunchAgents/`：

```bash
cp com.notion2ics.plist.example ~/Library/LaunchAgents/com.notion2ics.plist
```

3. 加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.notion2ics.plist
```

4. 启动服务：

```bash
launchctl start com.notion2ics
```

## 步骤 7: 在 macOS 日历中订阅

1. 打开 macOS 日历应用
2. 点击菜单栏中的"文件" > "新建日历订阅"
3. 输入 URL: `http://localhost:5000/calendar.ics`
4. 点击"订阅"
5. 配置如下设置:
   - 名称：选择一个便于识别的名称
   - 位置：建议选择"iCloud"以便在所有设备上同步
   - 自动刷新：选择合适的频率，如"每小时"
6. 点击"确定"完成订阅

## 故障排除

### 无法连接到 Notion API

- 检查您的 API 密钥是否正确
- 确认您已授权集成访问数据库

### 日历为空

- 确认数据库 ID 正确
- 检查字段映射是否正确
- 访问 http://localhost:5000/sync 手动触发同步，然后查看日志

### 服务未自动启动

- 检查日志文件是否有错误：`~/Library/Logs/notion2ics.log`
- 确认 plist 文件中的路径是否正确

## 其他配置选项

您可以在 `.env` 文件中调整其他配置选项：

```
PORT=5000  # Web 服务端口
HOST=127.0.0.1  # 监听地址（本地访问）或 0.0.0.0（远程访问）
DEBUG=False  # 调试模式
SYNC_INTERVAL=60  # 同步间隔（分钟）
``` 