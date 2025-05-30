#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import time
import logging
from datetime import datetime, timedelta
from flask import Flask, Response, send_file
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from notion_client import Client
from icalendar import Calendar, Event, vText, vCalAddress
import uuid
import pytz
import tempfile
import threading
import traceback

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 加载环境变量
load_dotenv()

# 配置
NOTION_API_KEY = os.getenv('NOTION_API_KEY')
NOTION_DATABASE_ID = os.getenv('NOTION_DATABASE_ID')
PORT = int(os.getenv('PORT', 5000))
HOST = os.getenv('HOST', '0.0.0.0')
DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', 't', '1', 'yes')
SYNC_INTERVAL = int(os.getenv('SYNC_INTERVAL', 60))  # 分钟

# 日历配置
CALENDAR_NAME = os.getenv('CALENDAR_NAME', '我的 Notion 日历')
CALENDAR_DESCRIPTION = os.getenv('CALENDAR_DESCRIPTION', '从 Notion 数据库自动同步的日历')

# Notion 字段映射
TITLE_PROPERTY = os.getenv('TITLE_PROPERTY', 'Name')
START_DATE_PROPERTY = os.getenv('START_DATE_PROPERTY', '日期')
END_DATE_PROPERTY = os.getenv('END_DATE_PROPERTY', '截止日期')
DESCRIPTION_PROPERTY = os.getenv('DESCRIPTION_PROPERTY', '备注')
LOCATION_PROPERTY = os.getenv('LOCATION_PROPERTY', '地点')

# 初始化 Flask 应用
app = Flask(__name__)

# 初始化 Notion 客户端
notion = Client(auth=NOTION_API_KEY)

# 缓存日历文件路径
calendar_file = os.path.join(tempfile.gettempdir(), 'notion_calendar.ics')
# Docker 环境中确保文件存储在挂载的卷上
if os.environ.get('DOCKER_ENV') == 'true':
    calendar_file = '/tmp/notion_calendar.ics'
last_sync_time = None
sync_lock = threading.Lock()

def get_notion_database():
    """从 Notion 获取数据库内容"""
    try:
        response = notion.databases.query(
            database_id=NOTION_DATABASE_ID
        )
        return response.get('results', [])
    except Exception as e:
        logger.error(f"获取 Notion 数据库失败: {e}")
        logger.error(traceback.format_exc())
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
            logger.warning(f"跳过无日期的事件: {title}")
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
        logger.error(f"处理事件失败: {title if 'title' in locals() else '未知'}: {e}")
        logger.error(traceback.format_exc())
        return None

def generate_ical():
    """生成 iCalendar 文件"""
    global last_sync_time
    
    with sync_lock:
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
        
        # 写入文件
        with open(calendar_file, 'wb') as f:
            f.write(cal.to_ical())
        
        last_sync_time = datetime.now()
        logger.info(f"日历已同步 - {events_count} 个事件 | {last_sync_time}")
        
        return cal

def sync_calendar():
    """同步日历的包装函数"""
    try:
        generate_ical()
    except Exception as e:
        logger.error(f"同步日历失败: {e}")
        logger.error(traceback.format_exc())

@app.route('/calendar.ics')
def serve_calendar():
    """提供日历文件下载"""
    if not os.path.exists(calendar_file) or last_sync_time is None:
        sync_calendar()
    
    response = send_file(
        calendar_file,
        mimetype='text/calendar',
        as_attachment=True,
        download_name='notion_calendar.ics'
    )
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

@app.route('/sync', methods=['GET'])
def trigger_sync():
    """手动触发同步"""
    sync_calendar()
    return {
        'status': 'success',
        'message': f'日历已同步于 {last_sync_time}',
        'timestamp': last_sync_time.isoformat() if last_sync_time else None
    }

@app.route('/status', methods=['GET'])
def status():
    """获取同步状态"""
    return {
        'status': 'ok',
        'last_sync': last_sync_time.isoformat() if last_sync_time else None,
        'calendar_file': calendar_file,
        'calendar_exists': os.path.exists(calendar_file)
    }

@app.route('/', methods=['GET'])
def index():
    """提供简单的 HTML 界面"""
    last_sync = last_sync_time.strftime('%Y-%m-%d %H:%M:%S') if last_sync_time else '从未'
    status_class = 'success' if last_sync_time and (datetime.now() - last_sync_time).total_seconds() < SYNC_INTERVAL * 120 else 'danger'
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Notion 日历同步</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body {{ padding: 20px; }}
            .container {{ max-width: 800px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="mb-4">Notion 日历同步</h1>
            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title">状态</h5>
                    <p class="card-text">上次同步: <span class="badge bg-{status_class}">{last_sync}</span></p>
                    <p class="card-text">同步间隔: {SYNC_INTERVAL} 分钟</p>
                    <a href="/sync" class="btn btn-primary">立即同步</a>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">日历订阅</h5>
                    <p class="card-text">将以下链接添加到您的日历应用:</p>
                    <div class="input-group mb-3">
                        <input type="text" class="form-control" value="http://{HOST}:{PORT}/calendar.ics" id="calendar-url" readonly>
                        <button class="btn btn-outline-secondary" type="button" onclick="copyToClipboard()">复制</button>
                    </div>
                    <p><a href="/calendar.ics" class="btn btn-outline-primary">下载 iCal 文件</a></p>
                </div>
            </div>
        </div>
        
        <script>
            function copyToClipboard() {{
                var copyText = document.getElementById("calendar-url");
                copyText.select();
                copyText.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(copyText.value);
                alert("链接已复制到剪贴板");
            }}
        </script>
    </body>
    </html>
    '''
    
    return html

def main():
    """主函数"""
    # 初始同步
    sync_calendar()
    
    # 设置定时同步
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        sync_calendar, 
        'interval', 
        minutes=SYNC_INTERVAL,
        id='calendar_sync_job'
    )
    scheduler.start()
    logger.info(f"已启动定时同步，间隔 {SYNC_INTERVAL} 分钟")
    
    try:
        # 启动 Flask 应用
        logger.info(f"启动 Web 服务器在 {HOST}:{PORT}")
        app.run(host=HOST, port=PORT, debug=DEBUG)
    except KeyboardInterrupt:
        logger.info("正在优雅退出...")
    finally:
        scheduler.shutdown()
        logger.info("应用已停止")

if __name__ == '__main__':
    main() 