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
  locationField: process.env.NOTION_LOCATION_FIELD || 'Location'
};

/**
 * 将UTC日期时间转换为北京时间（UTC+8）
 * @param {Date} utcDate - UTC时间的Date对象
 * @returns {Date} 北京时间的Date对象
 */
function convertToBeijingTime(utcDate) {
  // 创建一个新的Date对象，避免修改原始日期
  const beijingDate = new Date(utcDate);
  // 北京时间比UTC时间快8小时
  beijingDate.setHours(beijingDate.getHours() + 8);
  return beijingDate;
}

/**
 * 格式化日期为ICS日期数组
 * @param {Date} date - 日期对象
 * @param {boolean} includeTime - 是否包含时间
 * @returns {Array} ICS格式的日期数组
 */
function formatDateForICS(date, includeTime = true) {
  if (includeTime) {
    return [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes()
    ];
  } else {
    return [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate()
    ];
  }
}

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

    // 确定排序字段和方向
    const sortField = process.env.NOTION_SORT_FIELD || fieldMappings.dateField || 'Date';
    const sortDirection = process.env.NOTION_SORT_DIRECTION || 'ascending';
    
    console.log(`使用排序字段: ${sortField}，方向: ${sortDirection}`);

    // 获取历史和近期数据
    console.log('开始获取历史和近期工作安排...');
    
    // 定义页面大小
    const pageSize = 100; // 每页最大数量
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;
    
    // 使用分页循环获取所有数据
    while (hasMore) {
      console.log(`获取数据页，起始游标: ${startCursor || '无'}`);
      
      const response = await notion.databases.query({
        database_id: databaseId,
        sorts: [
          {
            property: sortField,
            direction: sortDirection,
          },
        ],
        page_size: pageSize,
        start_cursor: startCursor,
      });
      
      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      console.log(`获取到 ${response.results.length} 条数据，总计 ${allResults.length} 条，是否有更多: ${hasMore}`);
      
      // 为了避免API限制，如果数据超过500条或者已经获取了5页数据，则停止获取
      if (allResults.length > 500 || allResults.length >= pageSize * 5) {
        console.log(`数据量较大，已获取 ${allResults.length} 条记录，停止获取更多数据`);
        break;
      }
    }
    
    console.log(`共获取到 ${allResults.length} 条工作安排记录`);
    return allResults;
  } catch (error) {
    if (error.code === 'object_not_found') {
      throw new Error(`无法找到Notion数据库，请检查NOTION_DATABASE_ID是否正确，以及该集成是否已被授权访问数据库`);
    } else if (error.code === 'unauthorized') {
      throw new Error(`访问Notion API未授权，请检查NOTION_API_KEY是否正确`);
    } else if (error.code === 'validation_error' && error.message.includes('sort')) {
      // 获取当前使用的排序字段
      const sortField = process.env.NOTION_SORT_FIELD || fieldMappings.dateField || 'Date';
      throw new Error(`排序字段"${sortField}"无效，请检查数据库中是否存在此字段，或修改NOTION_SORT_FIELD环境变量`);
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
      let startDate, endDate, isAllDay = false;
      
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
            const utcStartDateTime = new Date(dateProp.start);
            // 转换为北京时间
            const beijingStartDateTime = convertToBeijingTime(utcStartDateTime);
            startDate = formatDateForICS(beijingStartDateTime, true);
            
            // 检查是否有结束日期
            if (dateProp.end) {
              const utcEndDateTime = new Date(dateProp.end);
              // 转换为北京时间
              const beijingEndDateTime = convertToBeijingTime(utcEndDateTime);
              endDate = formatDateForICS(beijingEndDateTime, true);
            } else {
              // 如果没有结束日期，则设置为开始日期后一小时
              const beijingEndDateTime = new Date(beijingStartDateTime);
              beijingEndDateTime.setHours(beijingEndDateTime.getHours() + 1);
              endDate = formatDateForICS(beijingEndDateTime, true);
            }
            
            // 添加时区信息
            console.log(`处理非全天事件: "${title}", 北京时间开始: ${beijingStartDateTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
          } else {
            // 没有时间组件，全天事件
            isAllDay = true;
            
            // 全天事件不需要进行时区转换，因为它不包含时间部分
            const startDay = new Date(dateProp.start);
            startDate = formatDateForICS(startDay, false);
            
            // 检查是否有结束日期
            if (dateProp.end) {
              const endDay = new Date(dateProp.end);
              // 对于全天事件，iCalendar的结束日期是非包含的，需要加一天
              endDay.setDate(endDay.getDate() + 1);
              endDate = formatDateForICS(endDay, false);
            } else {
              // 如果没有结束日期，则默认为一天
              const endDay = new Date(startDay);
              endDay.setDate(endDay.getDate() + 1);
              endDate = formatDateForICS(endDay, false);
            }
            
            console.log(`处理全天事件: "${title}", 日期: ${startDay.toISOString().split('T')[0]}`);
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
        end: endDate
      };
      
      // 全天事件特殊处理
      if (isAllDay) {
        icsEvent.startInputType = 'utc';
        icsEvent.endInputType = 'utc';
      } else {
        // 非全天事件指定为北京时间
        icsEvent.startOutputType = 'local';
        icsEvent.endOutputType = 'local';
      }
      
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

  console.log(`成功转换了 ${icsEvents.length} 个事件`);
  return icsEvents;
} 