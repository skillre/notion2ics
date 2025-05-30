from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
from .notion_utils import force_sync, last_sync_time
from flask import Response

def handler(request):
    """Vercel Python 处理函数，执行同步操作"""
    try:
        force_sync()
        response_data = {
            'status': 'success',
            'message': f'日历已同步于 {datetime.now().isoformat()}',
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        response_data = {
            'status': 'error',
            'message': str(e)
        }
    
    return Response(
        json.dumps(response_data),
        mimetype='application/json'
    ) 