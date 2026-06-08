FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create configs directory
RUN mkdir -p configs

EXPOSE 8001

CMD ["supervisord", "-c", "supervisord.conf"]
