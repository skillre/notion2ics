import { getCalendarEvents, convertToICSEvents } from '../../lib/notion';
import { createEvents } from 'ics';
import cors from 'cors';
import crypto from 'crypto';

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

/**
 * 验证访问令牌
 * @param {string} token - 提供的访问令牌
 * @returns {boolean} 令牌是否有效
 */
function validateToken(token) {
  if (!token) return false;
  
  // 从环境变量获取访问令牌
  const validToken = process.env.ACCESS_TOKEN;
  
  // 如果未设置环境变量中的访问令牌，则禁止所有访问
  if (!validToken) {
    console.warn('未配置ACCESS_TOKEN环境变量，禁止所有访问');
    return false;
  }
  
  // 使用恒定时间比较防止计时攻击
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(validToken)
  );
}

// 格式化错误信息，确保不泄露敏感信息
function formatErrorMessage(error) {
  // 获取基本错误信息
  const baseMessage = error.message || '未知错误';
  
  // 检查是否为Notion API错误
  if (error.code) {
    return `Notion API错误 (${error.code}): ${baseMessage}`;
  }

  // 检查是否缺少环境变量
  if (baseMessage.includes('NOTION_API_KEY') || baseMessage.includes('NOTION_DATABASE_ID')) {
    return `环境变量错误: ${baseMessage}`;
  }
  
  // 检查是否为字段映射错误
  if (baseMessage.includes('properties')) {
    return `字段映射错误: 找不到指定的字段或字段类型不正确，请检查环境变量配置`;
  }

  // 其他错误类型
  return `错误: ${baseMessage}`;
}

export default async function handler(req, res) {
  // 应用CORS中间件
  await runMiddleware(req, res, corsMiddleware);

  // 只允许GET请求
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }
  
  // 鉴权检查
  const { token } = req.query;
  
  // 检查是否提供了访问令牌并且令牌有效
  try {
    if (!validateToken(token)) {
      console.warn('访问令牌无效或未提供:', token);
      return res.status(401).json({
        error: '访问未授权，请提供有效的访问令牌',
        hint: '将访问令牌作为查询参数添加到URL: /api/calendar?token=YOUR_TOKEN'
      });
    }
  } catch (authError) {
    console.error('令牌验证出错:', authError);
    return res.status(500).json({ error: '授权验证失败' });
  }

  try {
    console.log('开始处理日历请求...');
    
    // 检查环境变量是否已配置
    if (!process.env.NOTION_API_KEY) {
      throw new Error('未设置 NOTION_API_KEY 环境变量');
    }
    
    if (!process.env.NOTION_DATABASE_ID) {
      throw new Error('未设置 NOTION_DATABASE_ID 环境变量');
    }
    
    // 每次请求都直接从Notion获取最新数据
    console.log('从Notion获取数据...');
    const notionEvents = await getCalendarEvents();
    console.log(`获取到 ${notionEvents.length} 个事件`);
    
    // 转换为ICS格式
    console.log('转换为ICS格式...');
    const icsEvents = convertToICSEvents(notionEvents);
    console.log(`成功转换 ${icsEvents.length} 个事件`);
    
    // 检查是否有有效事件
    if (icsEvents.length === 0) {
      console.warn('未找到有效的日历事件');
      // 但仍然继续生成空日历
    }
    
    // 生成ICS内容
    console.log('生成ICS内容...');
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
    console.log('日历生成成功，返回结果');
    res.status(200).send(icsContent);
  } catch (error) {
    // 详细记录错误信息
    console.error('处理日历请求时出错:', error);
    
    // 格式化友好的错误信息
    const errorMessage = formatErrorMessage(error);
    console.error('格式化后的错误信息:', errorMessage);
    
    // 返回更详细的错误信息给用户
    res.status(500).json({ 
      error: errorMessage,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 