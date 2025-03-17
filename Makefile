SERVICE_NAME=kotsek

build: build

run: up

stop: down

log: logs


build: 
	@echo "Building $(SERVICE_NAME)..."
	docker-compose build
up:
	@echo "Starting $(SERVICE_NAME)..."
	docker-compose up -d 
down:
	@echo "Stopping $(SERVICE_NAME)..."
	docker-compose down

restart: down up

rebuild:
	docker-compose down --volumes --remove-orphans
	docker-compose up --build

logs:
	docker logs flask-messenger-api