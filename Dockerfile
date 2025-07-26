FROM node:18-alpine

# Install build dependencies and FFmpeg for music
RUN apk add --no-cache python3 make g++ ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install -g typescript
RUN npm run build

# Remove dev dependencies and source files
RUN rm -rf src/
RUN npm prune --production

# Create data directory
RUN mkdir -p data logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose health check port
EXPOSE 8736

# Set environment
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"]