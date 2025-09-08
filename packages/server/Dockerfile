## Multi-stage Dockerfile using npm for the Express server
FROM node:20-alpine AS build
WORKDIR /app

# Copy only server package first (dependency install layer)
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/

WORKDIR /app/packages/server
RUN npm install --no-audit --no-fund

# Copy full source (monorepo) for build
WORKDIR /app
COPY . ./

WORKDIR /app/packages/server
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy production package.json and install prod deps
COPY packages/server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy compiled dist
COPY --from=build /app/packages/server/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
