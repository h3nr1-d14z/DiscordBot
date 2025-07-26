#!/bin/bash

# Discord Bot Startup Script

echo "🤖 Starting Discord Fun Bot..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Creating from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your Discord token!"
    exit 1
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "🔨 Building TypeScript..."
    npm run build
fi

# Start based on environment
if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 Starting in production mode with PM2..."
    pm2 start ecosystem.config.js
    pm2 logs
else
    echo "🔧 Starting in development mode..."
    npm run dev
fi