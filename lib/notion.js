import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 初始化Notion客户端
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

/**
 * 从Notion数据库获取所有日历事件
 * @returns {Promise<Array>} 事件列表
 */
export async function getCalendarEvents() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      throw new Error('未设置 NOTION_DATABASE_ID 环境变量');
    }

    // 查询数据库
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: 'Date',  // 假设数据库中有一个名为"Date"的属性
          direction: 'ascending',
        },
      ],
    });

    return response.results;
  } catch (error) {
    console.error('从Notion获取事件失败:', error);
    throw error;
  }
}

/**
 * 将Notion事件转换为iCalendar格式的事件
 * @param {Array} notionEvents - Notion事件列表
 * @returns {Array} iCalendar格式的事件列表
 */
export function convertToICSEvents(notionEvents) {
  const icsEvents = [];

  for (const event of notionEvents) {
    try {
      const properties = event.properties;
      
      // 获取标题
      const title = properties.Name?.title?.[0]?.plain_text || '未命名事件';
      
      // 获取日期和时间
      let startDate, endDate, allDay = false;
      
      if (properties.Date?.date) {
        const dateProperty = properties.Date.date;
        
        // 检查是否有起始日期
        if (dateProperty.start) {
          if (dateProperty.start.includes('T')) {
            // 有时间组件，非全天事件
            const startDateTime = new Date(dateProperty.start);
            startDate = [
              startDateTime.getFullYear(),
              startDateTime.getMonth() + 1,
              startDateTime.getDate(),
              startDateTime.getHours(),
              startDateTime.getMinutes()
            ];
            
            // 检查是否有结束日期
            if (dateProperty.end) {
              const endDateTime = new Date(dateProperty.end);
              endDate = [
                endDateTime.getFullYear(),
                endDateTime.getMonth() + 1,
                endDateTime.getDate(),
                endDateTime.getHours(),
                endDateTime.getMinutes()
              ];
            } else {
              // 如果没有结束日期，则设置为开始日期后一小时
              const endDateTime = new Date(startDateTime);
              endDateTime.setHours(endDateTime.getHours() + 1);
              endDate = [
                endDateTime.getFullYear(),
                endDateTime.getMonth() + 1,
                endDateTime.getDate(),
                endDateTime.getHours(),
                endDateTime.getMinutes()
              ];
            }
          } else {
            // 没有时间组件，全天事件
            allDay = true;
            const startDay = new Date(dateProperty.start);
            startDate = [
              startDay.getFullYear(),
              startDay.getMonth() + 1,
              startDay.getDate()
            ];
            
            // 检查是否有结束日期
            if (dateProperty.end) {
              const endDay = new Date(dateProperty.end);
              // 对于全天事件，iCalendar的结束日期是非包含的，需要加一天
              endDay.setDate(endDay.getDate() + 1);
              endDate = [
                endDay.getFullYear(),
                endDay.getMonth() + 1,
                endDay.getDate()
              ];
            } else {
              // 如果没有结束日期，则默认为一天
              const endDay = new Date(startDay);
              endDay.setDate(endDay.getDate() + 1);
              endDate = [
                endDay.getFullYear(),
                endDay.getMonth() + 1,
                endDay.getDate()
              ];
            }
          }
        }
      }

      // 获取描述
      const description = properties.Description?.rich_text?.[0]?.plain_text || '';
      
      // 获取位置
      const location = properties.Location?.rich_text?.[0]?.plain_text || '';

      // 创建ICS事件对象
      const icsEvent = {
        uid: event.id,
        title,
        description,
        location,
        start: startDate,
        end: endDate,
        allDay
      };
      
      icsEvents.push(icsEvent);
    } catch (error) {
      console.error('转换事件时出错:', error, event);
    }
  }

  return icsEvents;
} 