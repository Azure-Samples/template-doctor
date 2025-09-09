## Multi-stage Dockerfile using npm for the Express server
FROM node:20-alpine AS build
WORKDIR /app

# Install rsync for the build process
RUN apk add --no-cache rsync

# Copy root manifests & workspace info
COPY package.json package-lock.json* .npmrc* ./
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/
COPY packages/app/package.json ./packages/app/

# Install root (will hoist workspace deps) then server dev deps
RUN npm install --workspaces --no-audit --no-fund

# Copy full monorepo
COPY . .

# Build frontend first (it may rely on config/constants)
WORKDIR /app/packages/app
RUN npm run build

# Build server
WORKDIR /app/packages/server
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
	SERVE_FRONTEND=true \
	FRONTEND_DIST_PATH=public

# Copy production package.json & lock, install only prod deps for server
COPY packages/server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy server build output
COPY --from=build /app/packages/server/dist ./dist

# Copy built frontend dist into ./public
COPY --from=build /app/packages/app/dist ./public

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/index.js"]
