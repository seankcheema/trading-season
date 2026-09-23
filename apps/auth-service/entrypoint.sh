#!/bin/sh
# Entrypoint for auth service: generates JWT keys if not provided

set -e

# Check if JWT keys are already set via environment
if [ -z "$JWT_PRIVATE_KEY" ] || [ -z "$JWT_PUBLIC_KEY" ]; then
    echo "[INIT] Generating JWT keys..."
    
    # Generate RS256 keypair using OpenSSL (available in node:alpine)
    PRIVATE_KEY=$(openssl genrsa 2048 2>/dev/null | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
    PUBLIC_KEY=$(echo "$PRIVATE_KEY" | openssl rsa -pubout 2>/dev/null | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
    
    export JWT_PRIVATE_KEY="$PRIVATE_KEY"
    export JWT_PUBLIC_KEY="$PUBLIC_KEY"
    
    echo "[INIT] JWT keys generated and loaded into environment"
else
    echo "[INIT] JWT keys already provided via environment"
fi

# Start the application
exec node dist/main.js
