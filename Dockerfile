FROM node:22-slim AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

FROM node:22-slim AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig*.json ./
COPY server/src ./src
COPY server/migrations ./migrations
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HF_HOME=/app/.cache
COPY --from=server /app/node_modules ./node_modules
COPY --from=server /app/dist ./dist
COPY --from=server /app/migrations ./migrations
COPY --from=server /app/package.json ./package.json
COPY --from=client /client/dist ./public
RUN mkdir -p /app/.cache && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
