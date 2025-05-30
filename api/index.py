from http.server import BaseHTTPRequestHandler
import os
import json
from datetime import datetime
from urllib.parse import urlparse
from .notion_utils import last_sync_time
from flask import Response, request

def handler(req):
    """Vercel Python 处理函数，返回主页HTML"""
    host = req.headers.get('Host', 'localhost')
    current_url = f"https://{host}"
    status_class = 'success' if last_sync_time and (datetime.now() - last_sync_time).total_seconds() < 30 * 120 else 'danger'
    sync_time = last_sync_time.strftime('%Y-%m-%d %H:%M:%S') if last_sync_time else '从未同步'
    
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
                    <p class="card-text">上次同步: <span class="badge bg-{status_class}">{sync_time}</span></p>
                    <p class="card-text">同步间隔: 30 分钟</p>
                    <a href="/sync" class="btn btn-primary">立即同步</a>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">日历订阅</h5>
                    <p class="card-text">将以下链接添加到您的日历应用:</p>
                    <div class="input-group mb-3">
                        <input type="text" class="form-control" value="{current_url}/calendar.ics" id="calendar-url" readonly>
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
    
    return Response(
        html,
        mimetype='text/html'
    ) 