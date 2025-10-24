#!/bin/bash

echo "🧪 Testing START SESSION Endpoint..."
echo ""

# Test: Create a new session
echo "📝 Request:"
echo '{
  "walletAddress": "0x1234567890abcdef",
  "clientSeed": "user-random-seed"
}' | jq .

echo ""
echo "📡 Calling POST http://localhost:8001/api/cache/start-session"
echo ""

curl -X POST http://localhost:8001/api/cache/start-session \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890abcdef",
    "clientSeed": "user-random-seed"
  }' | jq .

echo ""
echo "✅ Test complete!"
