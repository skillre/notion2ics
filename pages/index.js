import { useState, useEffect } from 'react';
import Head from 'next/head';
import { generateShareUrl } from '../lib/ics-generator';

export default function Home() {
  const [calendarUrl, setCalendarUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [hasGeneratedUrl, setHasGeneratedUrl] = useState(false);
  const [personnelList, setPersonnelList] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [isLoadingPersonnel, setIsLoadingPersonnel] = useState(false);

  useEffect(() => {
    // 获取当前URL作为基础URL
    const baseUrl = window.location.origin;

    // 生成基本URL（不包含令牌）
    const url = generateShareUrl(baseUrl);
    setCalendarUrl(url);

    // 尝试从localStorage恢复保存的令牌
    const savedToken = localStorage.getItem('calendar_access_token');
    if (savedToken) {
      setAccessToken(savedToken);
    }

    // 获取人员列表
    const fetchPersonnel = async () => {
      setIsLoadingPersonnel(true);
      try {
        const res = await fetch('/api/personnel');
        if (res.ok) {
          const data = await res.json();
          setPersonnelList(data);
        }
      } catch (error) {
        console.error('获取人员列表失败:', error);
      } finally {
        setIsLoadingPersonnel(false);
      }
    };

    fetchPersonnel();
  }, []);

  // 生成带访问令牌的URL
  const generateSecureUrl = () => {
    const baseUrl = window.location.origin;
    const secureUrl = generateShareUrl(baseUrl, accessToken, selectedPersonId);
    setCalendarUrl(secureUrl);
    setHasGeneratedUrl(true);

    // 保存令牌到localStorage
    if (accessToken) {
      localStorage.setItem('calendar_access_token', accessToken);
    }
  };

  // 复制URL到剪贴板
  const copyToClipboard = () => {
    navigator.clipboard.writeText(calendarUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // 2秒后重置复制状态
    });
  };

  return (
    <div className="container">
      <Head>
        <title>Notion到日历同步工具</title>
        <meta name="description" content="将Notion数据库转换为iCalendar格式" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>Notion到日历同步工具</h1>

        <section className="info-section">
          <h2>👤 人员筛选（可选）</h2>
          <p>选择特定人员以仅同步与其相关的工作安排：</p>
          <div className="personnel-container">
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="personnel-select"
              disabled={isLoadingPersonnel}
            >
              <option value="">-- 显示所有人员 --</option>
              {personnelList.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            {isLoadingPersonnel && <span className="loading-text">加载中...</span>}
          </div>
        </section>

        <section className="info-section">
          <h2>🔒 安全访问</h2>
          <p>为保护您的日历数据安全，访问日历需要提供访问令牌：</p>
          <div className="token-container">
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="输入访问令牌"
              className="token-input"
            />
            <button
              onClick={generateSecureUrl}
              className="generate-button"
              disabled={!accessToken}
            >
              生成安全链接
            </button>
          </div>
          {hasGeneratedUrl && (
            <p className="success-text">✅ 已生成带访问令牌的安全链接</p>
          )}
          <p className="note-text">
            访问令牌是系统管理员配置的，必须与系统中设置的ACCESS_TOKEN环境变量一致。
          </p>
        </section>

        <section className="info-section">
          <h2>📅 您的日历链接</h2>
          <div className="url-container">
            <input
              type="text"
              value={calendarUrl}
              readOnly
              className="url-input"
            />
            <button
              onClick={copyToClipboard}
              className="copy-button"
            >
              {isCopied ? '已复制✓' : '复制'}
            </button>
          </div>
          <p className="update-info">
            <strong>实时更新：</strong> 每次日历应用请求数据时，系统都会自动从Notion获取最新内容。
          </p>
        </section>

        <section className="info-section">
          <h2>⚙️ 自定义字段说明</h2>
          <p>本应用支持通过环境变量自定义Notion数据库字段映射：</p>
          <table className="config-table">
            <thead>
              <tr>
                <th>环境变量</th>
                <th>默认值</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>NOTION_TITLE_FIELD</td>
                <td>Name</td>
                <td>事件标题字段（标题类型）</td>
              </tr>
              <tr>
                <td>NOTION_DATE_FIELD</td>
                <td>Date</td>
                <td>事件日期字段（日期类型）</td>
              </tr>
              <tr>
                <td>NOTION_DESCRIPTION_FIELD</td>
                <td>Description</td>
                <td>事件描述字段（富文本类型）</td>
              </tr>
              <tr>
                <td>NOTION_LOCATION_FIELD</td>
                <td>Location</td>
                <td>事件地点字段（富文本类型）</td>
              </tr>
              <tr>
                <td>NOTION_SORT_FIELD</td>
                <td>同日期字段</td>
                <td>结果排序字段</td>
              </tr>
              <tr>
                <td>NOTION_SORT_DIRECTION</td>
                <td>ascending</td>
                <td>排序方向（ascending或descending）</td>
              </tr>
            </tbody>
          </table>
          <p className="note-text">在Vercel的项目设置中配置上述环境变量，即可适配您的Notion数据库结构。</p>
        </section>

        <section className="info-section">
          <h2>📱 如何在设备上使用</h2>
          <h3>在macOS日历中订阅</h3>
          <ol>
            <li>打开macOS上的"日历"应用</li>
            <li>点击顶部菜单中的"文件" &gt; "新建日历订阅"</li>
            <li>粘贴上方的日历链接并点击"订阅"</li>
            <li>配置自动刷新选项（推荐设置为"每小时"，这样日历应用会每小时获取一次最新数据）</li>
            <li>点击"确定"完成设置</li>
          </ol>

          <h3>在iOS设备上订阅</h3>
          <ol>
            <li>前往"设置" &gt; "日历" &gt; "账户"</li>
            <li>点击"添加账户" &gt; "其他"</li>
            <li>点击"添加已订阅的日历"</li>
            <li>粘贴上方的日历链接并保存</li>
            <li>您可以在"设置" &gt; "日历" &gt; "账户" &gt; "获取新数据"中设置刷新频率</li>
          </ol>

          <div className="security-note">
            <h3>⚠️ 安全提示</h3>
            <p>
              请勿将带有访问令牌的URL分享给未经授权的人员。含有访问令牌的URL可以直接访问您的日历数据。
              如果您怀疑令牌已泄露，请联系系统管理员更改访问令牌。
            </p>
          </div>
        </section>
      </main>

      <footer>
        <p>由Notion API和Next.js提供支持</p>
      </footer>

      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          max-width: 800px;
          margin: 0 auto;
        }

        main {
          padding: 2rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        footer {
          width: 100%;
          height: 50px;
          border-top: 1px solid #eaeaea;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 2rem;
        }

        h1 {
          margin: 0;
          line-height: 1.15;
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 2rem;
          color: #0070f3;
        }

        h2 {
          font-size: 1.5rem;
          margin-top: 0;
        }

        h3 {
          font-size: 1.2rem;
          margin-top: 1rem;
        }

        .info-section {
          margin-bottom: 2rem;
          padding: 1.5rem;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          background-color: #fafafa;
        }

        .url-container, .token-container {
          display: flex;
          margin: 1rem 0;
        }

        .url-input, .token-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px 0 0 4px;
          font-size: 0.9rem;
          font-size: 0.9rem;
          color: #333;
        }

        .personnel-container {
          margin: 1rem 0;
          display: flex;
          align-items: center;
        }

        .personnel-select {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 0.9rem;
          color: #333;
          max-width: 300px;
          background-color: white;
        }

        .loading-text {
          margin-left: 10px;
          font-size: 0.8rem;
          color: #666;
        }

        .copy-button, .generate-button {
          padding: 0.5rem 1rem;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
          font-weight: bold;
        }

        .copy-button:hover, .generate-button:hover {
          background-color: #0051a2;
        }
        
        .generate-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }

        .update-info {
          margin-top: 1rem;
          padding: 0.8rem;
          background-color: #e6f7ff;
          border-left: 4px solid #1890ff;
          border-radius: 4px;
        }
        
        .success-text {
          color: #52c41a;
          font-weight: bold;
          margin-top: 0.5rem;
        }
        
        .note-text {
          font-size: 0.9rem;
          color: #666;
          font-style: italic;
          margin-top: 0.5rem;
        }
        
        .security-note {
          margin-top: 1.5rem;
          padding: 1rem;
          background-color: #fff1f0;
          border-left: 4px solid #ff4d4f;
          border-radius: 4px;
        }
        
        .security-note h3 {
          margin-top: 0;
          color: #cf1322;
        }

        .config-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        .config-table th, .config-table td {
          padding: 0.6rem;
          border: 1px solid #ddd;
          text-align: left;
        }

        .config-table th {
          background-color: #f2f2f2;
          font-weight: bold;
        }

        .config-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }

        ol {
          padding-left: 1.2rem;
        }

        li {
          margin: 0.5rem 0;
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
            Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
} 