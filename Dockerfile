FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=10000

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=10000

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
