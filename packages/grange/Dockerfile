FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY packages/grange/frontend/package.json ./
RUN npm install
COPY packages/grange/frontend ./
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/grange/package.json ./packages/grange/

RUN npm install

COPY packages/core ./packages/core
RUN npm run build -w @ecf/core

COPY packages/grange ./packages/grange
RUN npm run build -w @ecf/grange

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/packages/core/dist ./packages/core/dist
COPY --from=backend-builder /app/packages/core/package.json ./packages/core/
COPY --from=backend-builder /app/packages/grange/dist ./packages/grange/dist
COPY --from=backend-builder /app/packages/grange/package.json ./packages/grange/
COPY --from=frontend-builder /app/frontend/dist ./packages/grange/public

EXPOSE 3005
CMD ["node", "packages/grange/dist/index.js"]
