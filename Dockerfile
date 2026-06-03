# Dockerfile for shopify-x-integration
# Optimized for AWS App Runner, ECS/Fargate, Elastic Beanstalk (Docker), etc.
# Gives you a clean public HTTPS URL perfect for Shopify, eBay, and other webhooks.

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security (good practice on AWS)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Set ownership
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

# Health check (App Runner and load balancers like this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "src/server.js"]
