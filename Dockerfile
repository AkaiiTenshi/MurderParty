FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
# Build tools only matter when better-sqlite3 has no prebuilt binary (e.g. some ARM hosts).
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps

COPY src ./src

CMD ["node", "src/index.js"]
