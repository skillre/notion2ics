import { getCalendarEvents, convertToICSEvents } from '../../lib/notion';
import { createEvents } from 'ics';
import cors from 'cors';

// 配置CORS
const corsMiddleware = cors({
  methods: ['GET', 'HEAD'],
});

// 帮助函数，用于应用中间件
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // 应用CORS中间件
  await runMiddleware(req, res, corsMiddleware);

  // 只允许GET请求
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // 每次请求都直接从Notion获取最新数据
    const notionEvents = await getCalendarEvents();
    
    // 转换为ICS格式
    const icsEvents = convertToICSEvents(notionEvents);
    
    // 生成ICS内容
    const icsContent = await new Promise((resolve, reject) => {
      createEvents(icsEvents, (error, value) => {
        if (error) {
          console.error('创建ICS事件时出错:', error);
          reject(error);
          return;
        }
        resolve(value);
      });
    });

    // 设置响应头
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="notion-calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // 返回ICS内容
    res.status(200).send(icsContent);
  } catch (error) {
    console.error('处理日历请求时出错:', error);
    res.status(500).json({ error: '生成日历时出错' });
  }
} 