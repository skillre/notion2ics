import { generateICSFile } from '../../lib/ics-generator';

export default async function handler(req, res) {
  // 只允许POST请求
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // 生成新的ICS文件
    await generateICSFile();
    
    // 返回成功响应
    res.status(200).json({ success: true, message: '日历已同步' });
  } catch (error) {
    console.error('同步日历时出错:', error);
    res.status(500).json({ success: false, error: '同步日历时出错' });
  }
} 