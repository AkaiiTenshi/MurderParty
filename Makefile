.PHONY: build up down restart logs sh clean deploy test backup pull-backups restore

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

deploy:
	docker compose run --rm discord-bot node src/deploy-commands.js

test:
	npm test

# On the server: snapshot now (also done automatically every hour).
backup:
	docker compose exec discord-bot node src/backup.js

# On your PC: make pull-backups HOST=ubuntu@<PUBLIC_IP>
pull-backups:
	mkdir -p backups
	rsync -av $(HOST):~/MurderParty/data/backups/ backups/

# On your PC: make restore FILE=backups/latest.db  (stop the server bot first!)
restore:
	docker compose down
	sudo mkdir -p data
	sudo rm -f data/root.db data/root.db-wal data/root.db-shm
	sudo cp $(FILE) data/root.db
	docker compose up -d
