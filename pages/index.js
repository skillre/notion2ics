import { useState, useEffect } from 'react';
import Head from 'next/head';
import { generateShareUrl } from '../lib/ics-generator';

export default function Home() {
  const [calendarUrl, setCalendarUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    // 获取当前URL作为基础URL
    const baseUrl = window.location.origin;
    const url = generateShareUrl(baseUrl);
    setCalendarUrl(url);
  }, []);

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
            <li>前往"设置" &gt; "日历" &gt; "账户" &gt; "添加账户"</li>
            <li>选择"其他"</li>
            <li>点击"添加已订阅的日历"</li>
            <li>粘贴上方的日历链接并保存</li>
            <li>您可以在"设置" &gt; "日历" &gt; "账户" &gt; "获取新数据"中设置刷新频率</li>
          </ol>
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

        .url-container {
          display: flex;
          margin: 1rem 0;
        }

        .url-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px 0 0 4px;
          font-size: 0.9rem;
          color: #333;
        }

        .copy-button {
          padding: 0.5rem 1rem;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
          font-weight: bold;
        }

        .copy-button:hover {
          background-color: #0051a2;
        }

        .update-info {
          margin-top: 1rem;
          padding: 0.8rem;
          background-color: #e6f7ff;
          border-left: 4px solid #1890ff;
          border-radius: 4px;
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