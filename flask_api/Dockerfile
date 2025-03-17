FROM python:3.10-slim

WORKDIR /

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev libgl1 libglib2.0-0 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

CMD ["python", "manage.py"]

