from http.server import BaseHTTPRequestHandler
from .notion_utils import get_calendar_data
from flask import Response

def handler(request):
    """Vercel Python 处理函数，返回日历数据"""
    calendar_data = get_calendar_data()
    
    response = Response(
        calendar_data,
        mimetype='text/calendar',
    )
    
    response.headers['Content-Disposition'] = 'attachment; filename=notion_calendar.ics'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response 