# Dockerfile for shopify-x-integration
# Builds backend + React frontend into a single container for easy deploy to AWS App Runner, ECS, etc.
# The Express server serves the API + the built frontend static files (SPA).

FROM node:20-alpine AS base

# 1. Backend production deps
FROM base AS backend-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# 2. Build frontend (needs dev deps)
FROM base AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# 3. Final production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy backend prod deps
COPY --from=backend-deps /app/node_modules ./node_modules

# Copy app source (backend)
COPY src ./src
COPY package.json ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ownership
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "src/server.js"]
