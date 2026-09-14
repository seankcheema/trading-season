#!/bin/bash

# Jenkins with Node.js Setup Script
# This script builds and runs Jenkins with Node.js support

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker-compose/docker-compose.jenkins.yml"

echo "🚀 Starting Jenkins with Node.js..."
echo ""

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Build the custom Jenkins image
echo "📦 Building Jenkins Docker image with Node.js..."
docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache

# Start Jenkins
echo "▶️  Starting Jenkins container..."
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

# Wait for Jenkins to be ready
echo "⏳ Waiting for Jenkins to start (this may take 30-60 seconds)..."
sleep 10

# Get Jenkins container name
CONTAINER_ID=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q jenkins)

# Check if Jenkins is ready
MAX_ATTEMPTS=30
ATTEMPT=1
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if docker logs $CONTAINER_ID 2>&1 | grep -q "Jenkins is fully up and running"; then
        echo "✅ Jenkins is ready!"
        break
    fi
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "⚠️  Jenkins startup check timed out, but container should be running."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Jenkins is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Access Jenkins at: http://localhost:8080"
echo "👤 Username: admin"
echo "🔑 Password: admin"
echo ""
echo "🔧 Verify Node.js is installed:"
echo "   docker exec jenkins-with-nodejs node --version"
echo "   docker exec jenkins-with-nodejs npm --version"
echo ""
echo "🛑 To stop Jenkins:"
echo "   docker-compose -f $DOCKER_COMPOSE_FILE down"
echo ""
echo "📂 Jenkins data is persisted in: jenkins_home volume"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
