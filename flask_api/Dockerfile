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

# Set python3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# Upgrade pip and tools
RUN pip install --upgrade pip setuptools wheel

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

EXPOSE 5001

CMD ["python", "manage.py"]
