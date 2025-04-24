FROM node:20-alpine as builder

# Install system dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Second stage: runtime
FROM node:20-alpine

# Install required runtime dependencies
RUN apk add --no-cache python3 tzdata

# Set up timezone (UTC by default)
ENV TZ=UTC

# Set up non-root user
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Set working directory
WORKDIR /app

# Copy from builder stage
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/server ./server
COPY --from=builder --chown=appuser:appuser /app/shared ./shared
COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts
COPY --from=builder --chown=appuser:appuser /app/ecosystem.config.js ./

# Install PM2 globally
RUN npm install -g pm2 tsx

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start using PM2
CMD ["pm2-runtime", "ecosystem.config.js"]