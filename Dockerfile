FROM python:3.11-alpine

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app.py .

# 创建非root用户
RUN adduser -D appuser
USER appuser

# 暴露端口
EXPOSE 5000

# 启动应用
CMD ["python", "app.py"] 