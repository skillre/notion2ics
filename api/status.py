from http.server import BaseHTTPRequestHandler
import json
from .notion_utils import get_status
from flask import Response

def handler(request):
    """Vercel Python 处理函数，返回状态信息"""
    status_data = get_status()
    
    return Response(
        json.dumps(status_data),
        mimetype='application/json'
    ) 