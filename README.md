# Notion到日历同步工具 (Notion2ICS)

这个项目可以将Notion数据库中的日程安排自动转换为iCalendar (.ics)格式，并提供一个可以订阅的在线日历链接。通过这个链接，您可以在macOS、iOS和其他支持iCalendar订阅的设备上同步您的Notion日程安排。

## 功能特点

- 自动从Notion数据库获取日程安排
- 将Notion事件转换为标准iCalendar格式
- 提供可订阅的日历链接
- 自动每小时同步一次数据（可配置）
- 支持手动触发同步
- 适配全天事件和定时事件
- 包含事件标题、描述、位置等信息

## 必要条件

在部署此项目前，您需要：

1. 一个[Notion](https://www.notion.so)账户和包含日程安排的数据库
2. [Notion API密钥](https://www.notion.so/my-integrations)
3. 一个Vercel账户（用于部署）

## Notion数据库要求

您的Notion数据库需要具有以下属性：

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
   - `SYNC_INTERVAL`: （可选）同步间隔（分钟），默认为60
4. 点击"Deploy"开始部署

### 4. 在您的设备上订阅日历

#### 在macOS上：

1. 打开"日历"应用
2. 点击菜单栏中的"文件" > "新建日历订阅"
3. 输入您的Vercel应用URL并添加`/api/calendar`路径
   例如：`https://your-app-name.vercel.app/api/calendar`
4. 设置自动更新频率（推荐设置为"每小时"）

#### 在iOS上：

1. 前往"设置" > "日历" > "账户"
2. 点击"添加账户" > "其他"
3. 选择"添加已订阅的日历"
4. 输入同样的URL地址

## 本地开发

如果您想在本地开发和测试此项目：

1. 克隆仓库到本地
2. 安装依赖： `npm install`
3. 创建`.env.local`文件并添加必要的环境变量
4. 启动开发服务器： `npm run dev`
5. 访问 `http://localhost:3000` 查看应用

## 自定义

### 修改同步频率

默认情况下，日历每小时同步一次。您可以通过编辑`vercel.json`文件中的`crons`部分来修改同步频率：

```json
"crons": [
  {
    "path": "/api/sync",
    "schedule": "0 * * * *"  // 每小时的第0分钟
  }
]
```

### 调整数据库属性映射

如果您的Notion数据库使用了不同的属性名称，您可以修改`lib/notion.js`文件中的`convertToICSEvents`函数来映射正确的属性名称。

## 注意事项

- Vercel的免费计划对API调用次数有限制
- Notion API也有速率限制
- 确保您的Notion集成已被授权访问您的数据库

## 许可

此项目采用MIT许可证。

## 作者

[您的名字]

---

希望这个工具能帮助您更好地管理日程安排！如果有任何问题或建议，请通过GitHub Issues联系我。 