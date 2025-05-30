import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 初始化Notion客户端
let notion;
try {
  notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });
} catch (error) {
  console.error('初始化Notion客户端时出错:', error);
  throw new Error(`Notion客户端初始化失败: ${error.message}`);
}

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

    console.log(`使用以下字段映射:`, fieldMappings);

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
    if (error.code === 'object_not_found') {
      throw new Error(`无法找到Notion数据库，请检查NOTION_DATABASE_ID是否正确，以及该集成是否已被授权访问数据库`);
    } else if (error.code === 'unauthorized') {
      throw new Error(`访问Notion API未授权，请检查NOTION_API_KEY是否正确`);
    } else if (error.code === 'validation_error' && error.message.includes('sort')) {
      throw new Error(`排序字段"${fieldMappings.sortField}"无效，请检查NOTION_SORT_FIELD环境变量是否正确`);
    }
    
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
  const errors = [];

  if (!notionEvents || notionEvents.length === 0) {
    console.warn('Notion返回了0个事件，请检查数据库是否有内容');
  }

  for (const event of notionEvents) {
    try {
      const properties = event.properties;
      
      // 获取标题
      const titleProperty = properties[fieldMappings.titleField];
      if (!titleProperty || !titleProperty.title) {
        errors.push(`事件ID ${event.id} 缺少有效的标题字段"${fieldMappings.titleField}"，或字段类型不是"标题"`);
        continue; // 跳过此事件
      }
      const title = titleProperty.title?.[0]?.plain_text || '未命名事件';
      
      // 获取日期和时间
      let startDate, endDate, allDay = false;
      
      const dateProperty = properties[fieldMappings.dateField];
      if (!dateProperty || !dateProperty.date) {
        errors.push(`事件"${title}" 缺少有效的日期字段"${fieldMappings.dateField}"，或字段类型不是"日期"`);
        continue; // 跳过此事件
      }
      
      if (dateProperty.date) {
        const dateProp = dateProperty.date;
        
        // 检查是否有起始日期
        if (dateProp.start) {
          if (dateProp.start.includes('T')) {
            // 有时间组件，非全天事件
            const startDateTime = new Date(dateProp.start);
            startDate = [
              startDateTime.getFullYear(),
              startDateTime.getMonth() + 1,
              startDateTime.getDate(),
              startDateTime.getHours(),
              startDateTime.getMinutes()
            ];
            
            // 检查是否有结束日期
            if (dateProp.end) {
              const endDateTime = new Date(dateProp.end);
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
            const startDay = new Date(dateProp.start);
            startDate = [
              startDay.getFullYear(),
              startDay.getMonth() + 1,
              startDay.getDate()
            ];
            
            // 检查是否有结束日期
            if (dateProp.end) {
              const endDay = new Date(dateProp.end);
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
        } else {
          errors.push(`事件"${title}"的日期没有开始时间`);
          continue; // 跳过此事件
        }
      }

      // 获取描述
      let description = '';
      try {
        if (properties[fieldMappings.descriptionField]?.rich_text) {
          description = properties[fieldMappings.descriptionField].rich_text?.[0]?.plain_text || '';
        }
      } catch (descError) {
        console.warn(`获取事件"${title}"的描述时出错:`, descError);
      }
      
      // 获取位置
      let location = '';
      try {
        if (properties[fieldMappings.locationField]?.rich_text) {
          location = properties[fieldMappings.locationField].rich_text?.[0]?.plain_text || '';
        }
      } catch (locError) {
        console.warn(`获取事件"${title}"的位置时出错:`, locError);
      }

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
      console.error(`转换事件时出错:`, error);
      if (event && event.id) {
        errors.push(`处理事件ID ${event.id}时出错: ${error.message}`);
      } else {
        errors.push(`处理事件时出错: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`转换过程中发现 ${errors.length} 个错误:`);
    errors.forEach((err, i) => console.error(`[${i+1}] ${err}`));
    
    // 如果所有事件都转换失败，但我们有错误信息，抛出错误
    if (icsEvents.length === 0 && errors.length > 0) {
      throw new Error(`所有事件转换失败: ${errors[0]}${errors.length > 1 ? ` 和其他 ${errors.length - 1} 个错误` : ''}`);
    }
  }

  return icsEvents;
} 