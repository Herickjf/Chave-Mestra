# Compilação TypeScript e cópia das migrações SQL.
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Imagem de execução: apenas dependências de produção e artefatos compilados.
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libstdc++ \
    && addgroup -S app \
    && adduser -S app -G app
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps \
    && npm cache clean --force
COPY --from=build /app/dist ./dist

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
