.PHONY: build up down restart logs sh clean

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f discord-bot

sh:
	docker compose exec discord-bot sh

clean:
	docker compose down -v --rmi local
