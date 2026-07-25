#!/usr/bin/env bash
# start_mcp_servers.sh - Start all Legilimens MCP servers

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Legilimens MCP Server Startup ===${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo -e "${GREEN}✓ Loaded .env${NC}"
else
    echo -e "${YELLOW}⚠ No .env file found, using defaults${NC}"
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python3 not found${NC}"
    exit 1
fi

# Check if MCP servers directory exists
MCP_DIR="$(dirname "$0")/mcp"
if [ ! -d "$MCP_DIR" ]; then
    echo -e "${RED}✗ MCP directory not found at $MCP_DIR${NC}"
    exit 1
fi

# Install MCP dependencies if needed
if [ -f "$MCP_DIR/requirements.txt" ]; then
    echo -e "${GREEN}Installing MCP dependencies...${NC}"
    pip install -q -r "$MCP_DIR/requirements.txt"
fi

echo -e "${GREEN}MCP Servers ready. Use mcp.json with your MCP client.${NC}"
echo ""
echo "Available MCP servers:"
echo "  • vectorai-db      - Actian VectorAI DB (vector retrieval)"
echo "  • vector-analytics - Actian Vector (columnar analytics)"
echo "  • embedder         - bge-small-en embedder"
echo "  • gemini           - Gemini API (analogy rewrite)"
echo "  • elevenlabs       - ElevenLabs TTS"
echo ""
echo "Configuration: mcp.json"
echo ""
echo "To use with an MCP client, add mcp.json to your client config."
echo "Required environment variables:"
echo "  GEMINI_API_KEY     - For analogy generation"
echo "  ELEVENLABS_API_KEY - For TTS"
echo ""
echo "Database connections (already in mcp.json):"
echo "  VectorAI DB:  localhost:6574 (gRPC)"
echo "  Actian Vector: localhost:5432 (ODBC)"