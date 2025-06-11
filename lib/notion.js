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
 * 获取从2023年1月1日到当前日期后N个月的日期范围
 * @param {number} monthsRange - 结束日期的月数范围
 * @returns {Object} 开始和结束日期
 */
function getDateRangeForMonths(monthsRange = 2) {
  const now = new Date();
  
  // 计算开始日期固定为2023年1月1日
  const startDate = new Date('2023-01-01T00:00:00.000Z');
  startDate.setHours(0, 0, 0, 0); // 设置为当天开始时间
  
  // 计算结束日期（当前日期加上N个月）
  const endDate = new Date(now);
  endDate.setMonth(now.getMonth() + monthsRange + 1); // 加1是为了包含当前月的最后一天
  endDate.setDate(0); // 设置为月末（下个月的第0天）
  endDate.setHours(23, 59, 59, 999); // 设置为当天结束时间
  
  // 使用YYYY-MM-DD格式返回日期，这是Notion API要求的格式
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    start: formatDateString(startDate),
    end: formatDateString(endDate)
  };
}

/**
 * 处理Notion富文本字段，提取文本内容
 * @param {Array} richTextArray - Notion富文本数组
 * @param {string} eventTitle - 事件标题（用于日志）
 * @param {string} fieldName - 字段名称（用于日志）
 * @returns {string} 处理后的文本内容
 */
function processRichTextField(richTextArray, eventTitle, fieldName) {
  if (!richTextArray || richTextArray.length === 0) {
    console.log(`事件"${eventTitle}"的${fieldName}字段为空`);
    return '';
  }
  
  console.log(`处理事件"${eventTitle}"的${fieldName}，包含 ${richTextArray.length} 个文本块`);
  
  // 遍历所有rich_text元素并合并它们的plain_text
  let result = richTextArray
    .map(textObj => {
      // 获取文本内容
      let content = textObj.plain_text || '';
      
      // 根据类型处理不同的富文本元素
      if (textObj.type === 'mention') {
        const mention = textObj.mention;
        
        // 处理不同类型的mention
        if (mention?.type === 'page' && textObj.href) {
          // 页面引用，添加链接
          content = `${content} (${textObj.href})`;
        } else if (mention?.type === 'user') {
          // 用户提及
          content = `@${content}`;
        } else if (mention?.type === 'date') {
          // 日期提及
          content = `📅 ${content}`;
        }
      } else if (textObj.type === 'equation') {
        // 方程式
        content = `[方程式: ${content}]`;
      }
      
      // 应用文本格式（如果需要）
      if (textObj.annotations) {
        if (textObj.annotations.bold) content = `*${content}*`;
        if (textObj.annotations.italic) content = `_${content}_`;
        if (textObj.annotations.strikethrough) content = `~${content}~`;
        if (textObj.annotations.underline) content = `_${content}_`;
        if (textObj.annotations.code) content = `\`${content}\``;
      }
      
      return content;
    })
    .join('');
    
  // 处理转义字符（例如将'\\n'转换为实际的换行符）
  result = result.replace(/\\n/g, '\n');
  
  // 为调试目的记录处理后的内容
  const truncatedResult = result.length > 100 ? 
    result.substring(0, 100) + '...' : result;
  console.log(`事件"${eventTitle}"的处理后${fieldName}: ${truncatedResult}`);
  
  return result;
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
    
    // 从2023年1月1日到当前日期后2个月的日期范围
    const monthsRange = 2; // 可以通过环境变量配置
    const dateRange = getDateRangeForMonths(monthsRange);
    console.log(`获取日期范围(格式化): ${dateRange.start} 至 ${dateRange.end}`);
    console.log(`获取日期范围(ISO): ${dateRange.startISO} 至 ${dateRange.endISO}`);
    console.log(`当前日期: ${new Date().toISOString()}`);

    // 确定排序字段和方向
    const sortField = process.env.NOTION_SORT_FIELD || fieldMappings.dateField || 'Date';
    const sortDirection = process.env.NOTION_SORT_DIRECTION || 'ascending';
    
    console.log(`使用排序字段: ${sortField}，方向: ${sortDirection}`);

    // 获取历史和近期数据
    console.log('开始获取指定日期范围的工作安排...');
    
    // 定义页面大小（遵循API限制，设置为90条以确保安全）
    const pageSize = 90; // 每页最大数量，低于API限制的100，为安全起见
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;
    
    // 创建日期过滤器
    const dateFieldName = fieldMappings.dateField;
    console.log(`使用日期字段: ${dateFieldName} 进行过滤`);
    
    // 使用Notion推荐的过滤器格式
    const dateFilter = {
      and: [
        {
          property: dateFieldName,
          date: {
            on_or_after: dateRange.start
          }
        },
        {
          property: dateFieldName,
          date: {
            on_or_before: dateRange.end
          }
        }
      ]
    };
    
    console.log(`日期过滤器:`, JSON.stringify(dateFilter, null, 2));
    console.log(`日期范围起始: ${dateRange.start} (2023年1月1日)`);
    console.log(`日期范围结束: ${dateRange.end} (当前日期后${monthsRange}个月)`);

    // 实现智能分页加载
    const maxRequests = 20; // 设置最大请求次数，防止过多API调用
    let requestCount = 0;
    const requestDelay = 500; // 添加延迟，避免API限流（毫秒）
    
    // 使用分页循环获取所有数据
    while (hasMore && requestCount < maxRequests) {
      console.log(`获取数据页 #${requestCount + 1}，起始游标: ${startCursor || '无'}`);
      requestCount++;
      
      // 添加延迟，避免过快请求导致API限流
      if (requestCount > 1) {
        console.log(`等待 ${requestDelay}ms 后发送下一请求...`);
        await new Promise(resolve => setTimeout(resolve, requestDelay));
      }
      
      try {
        const response = await notion.databases.query({
          database_id: databaseId,
          sorts: [
            {
              property: sortField,
              direction: sortDirection,
            },
          ],
          filter: dateFilter,
          page_size: pageSize,
          start_cursor: startCursor,
        });
        
        console.log(`API响应状态: ${response ? '成功' : '失败'}`);
        console.log(`API返回结果数: ${response.results ? response.results.length : 0}`);
        
        if (response.results && response.results.length > 0) {
          // 记录第一个和最后一个事件的日期，用于调试
          try {
            const firstEvent = response.results[0];
            const lastEvent = response.results[response.results.length - 1];
            
            const firstDate = firstEvent.properties[dateFieldName]?.date?.start;
            const lastDate = lastEvent.properties[dateFieldName]?.date?.start;
            
            console.log(`首个事件日期: ${firstDate || '未知'}`);
            console.log(`末尾事件日期: ${lastDate || '未知'}`);
          } catch (logErr) {
            console.warn('提取日期用于日志时出错:', logErr);
          }
        }
        
        allResults = [...allResults, ...response.results];
        hasMore = response.has_more;
        startCursor = response.next_cursor;
        
        console.log(`获取到 ${response.results.length} 条数据，总计 ${allResults.length} 条，是否有更多数据: ${hasMore}`);
        
        // 如果返回的结果数小于请求的页大小，说明可能已经接近数据末尾，可以放慢查询频率
        if (response.results.length < pageSize) {
          console.log('返回数据不足一页，增加请求间隔时间...');
          await new Promise(resolve => setTimeout(resolve, requestDelay * 2));
        }
      } catch (queryError) {
        console.error('查询数据库时出错:', queryError);
        
        if (queryError.code === 'validation_error') {
          console.error('可能是过滤器格式错误:', queryError.message);
          throw queryError;
        }
        
        if (queryError.code === 'rate_limited') {
          console.warn('API请求频率受限，等待后重试...');
          await new Promise(resolve => setTimeout(resolve, 1000 * 5)); // 等待5秒后重试
          requestCount--; // 不计入请求次数，允许重试
          continue;
        }
        
        throw queryError;
      }
    }
    
    // 记录API请求次数和结果状态
    if (hasMore && requestCount >= maxRequests) {
      console.warn(`已达到最大请求次数限制(${maxRequests})，可能还有更多数据未获取。已获取 ${allResults.length} 条数据。`);
    } else if (!hasMore) {
      console.log(`已获取所有数据，共 ${allResults.length} 条，使用了 ${requestCount} 次API请求。`);
    }
    
    console.log(`共获取到 ${allResults.length} 条工作安排记录`);
    
    // 验证获取到的数据是否在日期范围内
    let inRangeCount = 0;
    let outOfRangeCount = 0;
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    for (const item of allResults) {
      try {
        const itemDate = item.properties[dateFieldName]?.date?.start;
        if (itemDate) {
          const date = new Date(itemDate);
          if (date >= startDate && date <= endDate) {
            inRangeCount++;
          } else {
            outOfRangeCount++;
            console.warn(`发现范围外的数据: ${itemDate}`);
          }
        }
      } catch (e) {
        console.warn('验证日期范围时出错:', e);
      }
    }
    
    console.log(`日期范围内的记录: ${inRangeCount}, 范围外的记录: ${outOfRangeCount}`);
    
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
      throw new Error(`过滤条件无效，请检查日期字段"${fieldMappings.dateField}"是否存在且格式正确: ${error.message}`);
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
          const richTextArray = properties[fieldMappings.descriptionField].rich_text;
          description = processRichTextField(richTextArray, title, fieldMappings.descriptionField);
        } else {
          console.log(`事件"${title}"没有描述字段或字段为空`);
        }
      } catch (descError) {
        console.error(`获取事件"${title}"的描述时出错:`, descError);
        console.error(descError);
      }
      
      // 获取位置
      let location = '';
      try {
        if (properties[fieldMappings.locationField]?.rich_text) {
          const richTextArray = properties[fieldMappings.locationField].rich_text;
          location = processRichTextField(richTextArray, title, fieldMappings.locationField);
        } else {
          console.log(`事件"${title}"没有位置字段或字段为空`);
        }
      } catch (locError) {
        console.error(`获取事件"${title}"的位置时出错:`, locError);
        console.error(locError);
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