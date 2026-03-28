FROM node:22-slim

WORKDIR /app

# Build tools needed for native modules (bcrypt, better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

EXPOSE 8001

CMD ["node", "src/server/index.js"]
