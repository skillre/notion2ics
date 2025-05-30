import { createEvents } from 'ics';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getCalendarEvents, convertToICSEvents } from './notion';

// 缓存文件路径
const CACHE_DIR = path.join(process.cwd(), '.ics-cache');
const ICS_FILE_PATH = path.join(CACHE_DIR, 'calendar.ics');

/**
 * 生成ICS文件
 * @returns {Promise<string>} ICS文件内容
 */
export async function generateICSFile() {
  try {
    // 确保缓存目录存在
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    // 获取Notion事件
    const notionEvents = await getCalendarEvents();
    
    // 转换为ICS格式
    const icsEvents = convertToICSEvents(notionEvents);
    
    return new Promise((resolve, reject) => {
      createEvents(icsEvents, (error, value) => {
        if (error) {
          console.error('创建ICS事件时出错:', error);
          reject(error);
          return;
        }
        
        // 写入ICS文件
        fs.writeFileSync(ICS_FILE_PATH, value);
        
        // 返回ICS内容
        resolve(value);
      });
    });
  } catch (error) {
    console.error('生成ICS文件时出错:', error);
    throw error;
  }
}

/**
 * 检查缓存的ICS文件是否存在，并在需要时生成新的文件
 * @returns {Promise<string>} ICS文件路径
 */
export async function getOrCreateICSFile() {
  try {
    // 检查缓存文件是否存在
    if (!fs.existsSync(ICS_FILE_PATH)) {
      // 如果不存在，生成新的ICS文件
      await generateICSFile();
    }
    
    return ICS_FILE_PATH;
  } catch (error) {
    console.error('获取ICS文件时出错:', error);
    throw error;
  }
}

/**
 * 读取缓存的ICS文件内容
 * @returns {Promise<string>} ICS文件内容
 */
export async function getICSContent() {
  try {
    // 获取ICS文件路径
    const icsFilePath = await getOrCreateICSFile();
    
    // 读取ICS文件内容
    return fs.readFileSync(icsFilePath, 'utf-8');
  } catch (error) {
    console.error('读取ICS文件时出错:', error);
    throw error;
  }
}

/**
 * 生成用于分享的唯一ICS文件URL
 * @param {string} baseUrl - 基本URL
 * @returns {string} 分享URL
 */
export function generateShareUrl(baseUrl) {
  // 移除尾部斜杠
  const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') 
    ? baseUrl.slice(0, -1) 
    : baseUrl;
  
  return `${baseUrlWithoutTrailingSlash}/api/calendar`;
} 