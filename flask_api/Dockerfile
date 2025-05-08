# Use NVIDIA base image with Python and CUDA support
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

WORKDIR /app

ENV PYTHONPATH="/app"

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-dev \
    python3-pip \
    gcc \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN apt update && apt install -y ffmpeg


# Set python3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# Upgrade pip and tools
RUN pip install --upgrade pip setuptools wheel

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY paddle_models /paddle_models

RUN mkdir -p /root/.paddleocr/whl/det/en/ && \
    mkdir -p /root/.paddleocr/whl/rec/en/ && \
    mkdir -p /root/.paddleocr/whl/cls/ && \
    cp -r /paddle_models/det/en/en_PP-OCRv3_det_infer /root/.paddleocr/whl/det/en/ && \
    cp -r /paddle_models/rec/en/en_PP-OCRv4_rec_infer /root/.paddleocr/whl/rec/en/ && \
    cp -r /paddle_models/cls/ch_ppocr_mobile_v2.0_cls_infer /root/.paddleocr/whl/cls/
# Copy app source
COPY . .


EXPOSE 5001

CMD ["python", "manage.py"]


# =============================================
# FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# WORKDIR /app

# ENV PYTHONPATH="/app"

# # Install system dependencies
# RUN apt-get update && \
#     apt-get install -y --no-install-recommends \
#     python3.10 \
#     python3.10-dev \
#     python3-pip \
#     gcc \
#     libgl1 \
#     libglib2.0-0 \
#     ffmpeg \
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# RUN apt update && apt install -y ffmpeg


# # Set python3.10 as default
# RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# # Upgrade pip and tools
# RUN pip install --upgrade pip setuptools wheel

# # Copy and install Python dependencies
# COPY requirements.txt .
# COPY wheels/ ./wheels/ 
# RUN pip install --find-links=./wheels -r requirements.txt || \
#     pip install -r requirements.txt


# COPY paddle_models /paddle_models

# RUN mkdir -p /root/.paddleocr/whl/det/en/ && \
#     mkdir -p /root/.paddleocr/whl/rec/en/ && \
#     mkdir -p /root/.paddleocr/whl/cls/ && \
#     cp -r /paddle_models/det/en/en_PP-OCRv3_det_infer /root/.paddleocr/whl/det/en/ && \
#     cp -r /paddle_models/rec/en/en_PP-OCRv4_rec_infer /root/.paddleocr/whl/rec/en/ && \
#     cp -r /paddle_models/cls/ch_ppocr_mobile_v2.0_cls_infer /root/.paddleocr/whl/cls/
# # Copy app source
# COPY . .


# EXPOSE 5001

# CMD ["python", "manage.py"]


# akin to


# FROM python:3.10-slim

# WORKDIR /

# RUN apt-get update && \

#     apt-get install -y --no-install-recommends gcc python3-dev libgl1 libglib2.0-0 ffmpeg && \
#     rm -rf /var/lib/apt/lists/*

# RUN pip install --upgrade pip


# COPY requirements.txt .

# RUN pip install --no-cache-dir -r requirements.txt


# COPY . .


# EXPOSE 5001

# CMD ["python", "manage.py"]