# Notion到日历同步工具 (Notion2ICS)

这个项目可以将Notion数据库中的日程安排自动转换为iCalendar (.ics)格式，并提供一个可以订阅的在线日历链接。通过这个链接，您可以在macOS、iOS和其他支持iCalendar订阅的设备上同步您的Notion日程安排。

## 功能特点

- 实时从Notion数据库获取日程安排
- 将Notion事件转换为标准iCalendar格式
- 提供可订阅的日历链接
- 实时响应，每次日历应用请求时都获取最新数据
- 适配全天事件和定时事件
- 包含事件标题、描述、位置等信息
- 支持自定义Notion字段映射，适应不同的数据库结构

## 必要条件

在部署此项目前，您需要：

1. 一个[Notion](https://www.notion.so)账户和包含日程安排的数据库
2. [Notion API密钥](https://www.notion.so/my-integrations)
3. 一个Vercel账户（用于部署）

## Notion数据库要求

您的Notion数据库需要包含日期信息，默认会查找以下属性（所有属性名称均可通过环境变量自定义）：

- `Name`: 标题类型，用作事件标题
- `Date`: 日期类型，包含事件的开始和结束时间
- `Description`: 富文本类型（可选），用作事件描述
- `Location`: 富文本类型（可选），用作事件地点

## 部署步骤

### 1. Fork或Clone此仓库

首先，将此仓库Fork到您的GitHub账户，或直接克隆到本地。

### 2. 获取Notion API密钥和数据库ID

1. 访问[Notion Integrations](https://www.notion.so/my-integrations)创建一个新的集成
2. 为集成授予适当的权限（至少需要读取数据库的权限）
3. 复制生成的API密钥
4. 在您的Notion数据库页面，点击"分享"并将您刚创建的集成添加为成员
5. 从数据库URL中获取数据库ID（格式为：https://www.notion.so/workspace/[数据库ID]?v=...)

### 3. 部署到Vercel

1. 登录[Vercel](https://vercel.com)
2. 点击"New Project"并从GitHub导入您的仓库
3. 在环境变量设置中添加以下变量：
   - `NOTION_API_KEY`: 您的Notion API密钥
   - `NOTION_DATABASE_ID`: 您的Notion数据库ID
   - 可选：根据您的数据库结构配置自定义字段映射（见下文）
4. 点击"Deploy"开始部署

### 4. 在您的设备上订阅日历

#### 在macOS上：

1. 打开"日历"应用
2. 点击菜单栏中的"文件" > "新建日历订阅"
3. 输入您的Vercel应用URL并添加`/api/calendar`路径
   例如：`https://your-app-name.vercel.app/api/calendar`
4. 设置自动更新频率（推荐设置为"每小时"，这样日历应用会每小时获取一次最新数据）

#### 在iOS上：

1. 前往"设置" > "日历" > "账户"
2. 点击"添加账户" > "其他"
3. 选择"添加已订阅的日历"
4. 输入同样的URL地址
5. 您可以在"设置" > "日历" > "账户" > "获取新数据"中设置刷新频率

## 自定义字段映射

如果您的Notion数据库使用了与默认不同的属性名称，可以通过设置以下环境变量来自定义字段映射：

| 环境变量 | 默认值 | 说明 |
|---------|-------|-----|
| NOTION_TITLE_FIELD | Name | 事件标题字段（标题类型）|
| NOTION_DATE_FIELD | Date | 事件日期字段（日期类型）|
| NOTION_DESCRIPTION_FIELD | Description | 事件描述字段（富文本类型）|
| NOTION_LOCATION_FIELD | Location | 事件地点字段（富文本类型）|

例如，如果您的Notion数据库使用"事件名称"作为标题，"时间"作为日期，可以设置以下环境变量：

```
NOTION_TITLE_FIELD=事件名称
NOTION_DATE_FIELD=时间
```

这些环境变量可以在Vercel的项目设置中配置：

1. 进入您的项目
2. 点击"Settings"选项卡
3. 找到"Environment Variables"部分
4. 添加所需的环境变量和对应的值
5. 保存更改并重新部署项目

## 本地开发

如果您想在本地开发和测试此项目：

1. 克隆仓库到本地
2. 安装依赖： `npm install`
3. 创建`.env.local`文件并添加必要的环境变量
   ```
   NOTION_API_KEY=your_notion_api_key_here
   NOTION_DATABASE_ID=your_notion_database_id_here
   # 可选：自定义字段映射
   NOTION_TITLE_FIELD=自定义标题字段
   NOTION_DATE_FIELD=自定义日期字段
   ```
4. 启动开发服务器： `npm run dev`
5. 访问 `http://localhost:3000` 查看应用

## 工作原理

本项目采用"实时获取"机制，与传统的定时同步不同：

- 每次日历应用请求ICS文件时，服务器都会直接从Notion获取最新数据
- 这确保了您始终能看到最新的Notion日程安排
- 日历更新频率取决于您在日历应用中设置的刷新频率
- 无需依赖额外的定时任务，更简单可靠

## 注意事项

- 频繁的日历刷新可能会导致更多的API调用
- Notion API有速率限制，请根据您的需求适当设置日历的刷新频率
- 确保您的Notion集成已被授权访问您的数据库
- 如果修改了字段映射，确保对应的字段类型正确，否则可能导致数据无法正确转换

## 许可

此项目采用MIT许可证。

## 作者

[skillre]

---

希望这个工具能帮助您更好地管理日程安排！如果有任何问题或建议，请通过GitHub Issues联系我。 