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
  
  // 工作计划字段 - 默认为"工作计划"
  planField: process.env.NOTION_PLAN_FIELD || '工作计划'
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
 * 获取前后N个月的日期范围
 * @param {number} monthsRange - 月数范围
 * @returns {Object} 开始和结束日期
 */
function getDateRangeForMonths(monthsRange = 2) {
  const now = new Date();
  
  // 计算开始日期（当前日期减去N个月）
  const startDate = new Date(now);
  startDate.setMonth(now.getMonth() - monthsRange);
  startDate.setDate(1); // 设置为月初
  startDate.setHours(0, 0, 0, 0); // 设置为当天开始时间
  
  // 计算结束日期（当前日期加上N个月）
  const endDate = new Date(now);
  endDate.setMonth(now.getMonth() + monthsRange + 1); // 加1是为了包含当前月的最后一天
  endDate.setDate(0); // 设置为月末（下个月的第0天）
  endDate.setHours(23, 59, 59, 999); // 设置为当天结束时间
  
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
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
    
    // 获取当前时间前后2个月的日期范围
    const dateRange = getDateRangeForMonths(2);
    console.log(`获取日期范围: ${new Date(dateRange.start).toLocaleDateString('zh-CN')} 至 ${new Date(dateRange.end).toLocaleDateString('zh-CN')}`);

    // 确定排序字段和方向
    const sortField = process.env.NOTION_SORT_FIELD || fieldMappings.dateField || 'Date';
    const sortDirection = process.env.NOTION_SORT_DIRECTION || 'ascending';
    
    console.log(`使用排序字段: ${sortField}，方向: ${sortDirection}`);

    // 获取历史和近期数据
    console.log('开始获取指定日期范围的工作安排...');
    
    // 定义页面大小
    const pageSize = 100; // 每页最大数量
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;
    
    // 创建日期过滤器
    const dateFieldName = fieldMappings.dateField;
    const dateFilter = {
      property: dateFieldName,
      date: {
        // 日期可以在开始日期之后，也可以包含开始日期
        on_or_after: dateRange.start.split('T')[0],
        // 日期可以在结束日期之前，也可以包含结束日期
        on_or_before: dateRange.end.split('T')[0]
      }
    };
    
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
        filter: dateFilter, // 添加日期过滤器
        page_size: pageSize,
        start_cursor: startCursor,
      });
      
      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      console.log(`获取到 ${response.results.length} 条数据，总计 ${allResults.length} 条，是否有更多: ${hasMore}`);
      
      // 如果没有更多数据，或者已经获取了足够多的数据，则停止获取
      if (!hasMore || allResults.length >= pageSize * 5) {
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
    } else if (error.code === 'validation_error' && error.message.includes('filter')) {
      throw new Error(`过滤条件无效，请检查日期字段"${fieldMappings.dateField}"是否存在且格式正确`);
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
      
      // 获取工作计划
      let workPlan = '';
      try {
        // 工作计划字段可能是富文本格式
        if (properties[fieldMappings.planField]?.rich_text) {
          workPlan = properties[fieldMappings.planField].rich_text
            .map(text => text.plain_text)
            .join('\n')
            .trim();
        }
        // 也可能是多行文本格式
        else if (properties[fieldMappings.planField]?.type === 'rich_text') {
          workPlan = properties[fieldMappings.planField].rich_text
            .map(text => text.plain_text)
            .join('\n')
            .trim();
        }
        // 也可能是其他文本格式
        else if (properties[fieldMappings.planField]?.type === 'text') {
          workPlan = properties[fieldMappings.planField].text?.content || '';
        }
      } catch (planError) {
        console.warn(`获取事件"${title}"的工作计划时出错:`, planError);
      }
      
      // 如果有工作计划内容，添加到描述中
      if (workPlan) {
        if (description) {
          description += '\n\n--- 工作计划 ---\n' + workPlan;
        } else {
          description = '--- 工作计划 ---\n' + workPlan;
        }
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