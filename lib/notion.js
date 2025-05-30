import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 初始化Notion客户端
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 从环境变量获取字段映射
const fieldMappings = {
  // 标题字段 - 默认为"Name"
  titleField: process.env.NOTION_TITLE_FIELD || 'Name',
  
  // 日期字段 - 默认为"Date"
  dateField: process.env.NOTION_DATE_FIELD || 'Date',
  
  // 描述字段 - 默认为"Description"
  descriptionField: process.env.NOTION_DESCRIPTION_FIELD || 'Description',
  
  // 位置字段 - 默认为"Location"
  locationField: process.env.NOTION_LOCATION_FIELD || 'Location',
  
  // 排序字段 - 默认为日期字段
  sortField: process.env.NOTION_SORT_FIELD || process.env.NOTION_DATE_FIELD || 'Date',
  
  // 排序方向 - 默认为升序
  sortDirection: process.env.NOTION_SORT_DIRECTION || 'ascending'
};

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
          property: fieldMappings.sortField,
          direction: fieldMappings.sortDirection,
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
      const title = properties[fieldMappings.titleField]?.title?.[0]?.plain_text || '未命名事件';
      
      // 获取日期和时间
      let startDate, endDate, allDay = false;
      
      if (properties[fieldMappings.dateField]?.date) {
        const dateProperty = properties[fieldMappings.dateField].date;
        
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
      const description = properties[fieldMappings.descriptionField]?.rich_text?.[0]?.plain_text || '';
      
      // 获取位置
      const location = properties[fieldMappings.locationField]?.rich_text?.[0]?.plain_text || '';

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