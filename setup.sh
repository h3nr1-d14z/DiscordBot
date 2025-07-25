#!/bin/bash

echo "🚀 Discord Fun Bot Setup Script"
echo "=============================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please edit .env and add your Discord bot token and other configuration!"
    echo "   You can get a bot token from: https://discord.com/developers/applications"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs data dist

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the bot:"
echo "  Development: npm run dev"
echo "  Production:  npm start"
echo ""
echo "Available commands:"
echo "  npm run dev    - Start in development mode with hot reload"
echo "  npm run build  - Build TypeScript files"
echo "  npm start      - Start in production mode"
echo "  npm run lint   - Run ESLint"
echo "  npm test       - Run tests"