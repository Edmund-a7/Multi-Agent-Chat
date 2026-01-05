# Stage 1: Build client
FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS production

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy server production dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Rebuild better-sqlite3 for Alpine
RUN npm rebuild better-sqlite3

# Copy built server
COPY --from=server-builder /app/server/dist ./dist

# Copy built client to public folder
COPY --from=client-builder /app/client/dist ./public

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
