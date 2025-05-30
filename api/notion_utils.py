import os
import json
import time
from datetime import datetime, timedelta
import pytz
from notion_client import Client
from icalendar import Calendar, Event
from urllib.parse import urlparse, parse_qs
import logging

# 配置
from dotenv import load_dotenv
load_dotenv()

# 获取环境变量
NOTION_API_KEY = os.environ.get('NOTION_API_KEY')
NOTION_DATABASE_ID = os.environ.get('NOTION_DATABASE_ID')
CALENDAR_NAME = os.environ.get('CALENDAR_NAME', '我的 Notion 日历')
CALENDAR_DESCRIPTION = os.environ.get('CALENDAR_DESCRIPTION', '从 Notion 数据库自动同步的日历')

# Notion 字段映射
TITLE_PROPERTY = os.environ.get('TITLE_PROPERTY', 'Name')
START_DATE_PROPERTY = os.environ.get('START_DATE_PROPERTY', '日期')
END_DATE_PROPERTY = os.environ.get('END_DATE_PROPERTY', '截止日期')
DESCRIPTION_PROPERTY = os.environ.get('DESCRIPTION_PROPERTY', '备注')
LOCATION_PROPERTY = os.environ.get('LOCATION_PROPERTY', '地点')

# 初始化 Notion 客户端
notion = Client(auth=NOTION_API_KEY)

# Vercel 的 KV 存储模拟（在实际使用中替换为真正的KV存储）
calendar_data = None
last_sync_time = None

def get_notion_database():
    """从 Notion 获取数据库内容"""
    try:
        response = notion.databases.query(
            database_id=NOTION_DATABASE_ID
        )
        return response.get('results', [])
    except Exception as e:
        logging.error(f"获取 Notion 数据库失败: {e}")
        return []

def create_calendar_event(page):
    """从 Notion 页面创建日历事件"""
    try:
        properties = page.get('properties', {})
        
        # 获取标题
        title = properties.get(TITLE_PROPERTY, {})
        if 'title' in title:
            title = ' '.join([t.get('plain_text', '') for t in title.get('title', [])])
        else:
            title = "无标题事件"
        
        # 获取日期
        start_date = properties.get(START_DATE_PROPERTY, {}).get('date', {})
        if not start_date:
            logging.warning(f"跳过无日期的事件: {title}")
            return None
            
        start = start_date.get('start')
        end = start_date.get('end') or properties.get(END_DATE_PROPERTY, {}).get('date', {}).get('start') or start
        
        # 处理全天事件
        is_all_day = not ('T' in start)
        
        # 创建事件
        event = Event()
        event.add('summary', title)
        event.add('uid', f"notion-{page.get('id')}")
        
        # 设置日期
        if is_all_day:
            event.add('dtstart', datetime.strptime(start, '%Y-%m-%d').date())
            if end:
                # 处理结束日期 (iCalendar 全天事件结束日期是独占的)
                end_date = datetime.strptime(end, '%Y-%m-%d').date() + timedelta(days=1)
                event.add('dtend', end_date)
        else:
            start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
            event.add('dtstart', start_dt)
            if end:
                end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
                event.add('dtend', end_dt)
        
        # 添加描述
        description_obj = properties.get(DESCRIPTION_PROPERTY, {})
        if description_obj:
            if 'rich_text' in description_obj:
                description = ' '.join([t.get('plain_text', '') for t in description_obj.get('rich_text', [])])
                if description:
                    event.add('description', description)
        
        # 添加链接到 Notion
        event.add('url', page.get('url', ''))
        
        # 添加地点
        location_obj = properties.get(LOCATION_PROPERTY, {})
        if location_obj:
            if 'rich_text' in location_obj:
                location = ' '.join([t.get('plain_text', '') for t in location_obj.get('rich_text', [])])
                if location:
                    event.add('location', location)
        
        # 创建时间戳
        now = datetime.now(pytz.UTC)
        event.add('dtstamp', now)
        event.add('created', now)
        event.add('last-modified', now)
        
        return event
    except Exception as e:
        logging.error(f"处理事件失败: {title if 'title' in locals() else '未知'}: {e}")
        return None

def generate_ical():
    """生成 iCalendar 数据"""
    global calendar_data, last_sync_time
    
    # 创建日历
    cal = Calendar()
    
    # 设置日历属性
    cal.add('prodid', '-//Notion2iCal//EN')
    cal.add('version', '2.0')
    cal.add('calscale', 'GREGORIAN')
    cal.add('method', 'PUBLISH')
    cal.add('x-wr-calname', CALENDAR_NAME)
    cal.add('x-wr-caldesc', CALENDAR_DESCRIPTION)
    cal.add('x-wr-timezone', 'Asia/Shanghai')
    
    # 获取 Notion 数据
    pages = get_notion_database()
    events_count = 0
    
    # 处理每个页面
    for page in pages:
        event = create_calendar_event(page)
        if event:
            cal.add_component(event)
            events_count += 1
    
    # 保存数据
    calendar_data = cal.to_ical()
    last_sync_time = datetime.now()
    
    logging.info(f"日历已同步 - {events_count} 个事件 | {last_sync_time}")
    
    return calendar_data

def get_calendar_data():
    """获取日历数据（如果需要则生成）"""
    global calendar_data, last_sync_time
    
    # 如果没有数据或者超过30分钟，则重新生成
    if calendar_data is None or last_sync_time is None or \
       (datetime.now() - last_sync_time).total_seconds() > 30 * 60:
        return generate_ical()
    
    return calendar_data

def force_sync():
    """强制同步"""
    return generate_ical()

def get_status():
    """获取状态"""
    return {
        "status": "ok" if NOTION_API_KEY and NOTION_DATABASE_ID else "未配置",
        "last_sync": last_sync_time.isoformat() if last_sync_time else None,
        "has_data": calendar_data is not None
    } 