# sa mga naka NVIDIA na GPU

# Use NVIDIA base image with Python and CUDA support
# from python:3.10-slim

# WORKDIR /app


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

# # Set python3.10 as default
# RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# # Upgrade pip and tools
# RUN pip install --upgrade pip setuptools wheel

# # Copy and install Python dependencies
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy app source
# COPY . .

# EXPOSE 5001

# CMD ["python", "manage.py"]



# akin to


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