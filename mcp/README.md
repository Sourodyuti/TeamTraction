# Legilimens MCP Servers

Model Context Protocol (MCP) servers for the **Legilimens** (TeamTraction) hackathon project.

These servers expose the core on-prem services as MCP tools for AI-assisted development, testing, and demonstration.

## Servers

| Server | File | Purpose | Tools |
|--------|------|---------|-------|
| **VectorAI DB** | `mcp/vectorai_db_mcp.py` | Vector retrieval (Qdrant) | `create_collection`, `upsert_points`, `search_similar`, `get_collections`, `get_collection_info`, `delete_points`, `health` |
| **Vector Analytics** | `mcp/vector_analytics_mcp.py` | Columnar SQL analytics | `insert_event`, `insert_batch_events`, `top_moments`, `density_timeline`, `cohort_heatmap`, `execute_sql`, `health` |
| **Embedder** | `mcp/embedder_mcp.py` | bge-small-en 384-dim embeddings | `encode`, `encode_with_latency`, `model_info` |
| **Gemini** | `mcp/gemini_mcp.py` | Analogy rewrite (Gemino) | `rewrite_analogy`, `list_avatars`, `health` |
| **ElevenLabs** | `mcp/elevenlabs_mcp.py` | TTS voice re-delivery (Sonorus) | `text_to_speech`, `list_voices`, `health` |

## Quick Start

### 1. Install Dependencies
```bash
pip install -r mcp/requirements.txt
```

### 2. Configure Environment
```bash
cp .env.mcp .env
# Edit .env with your API keys:
# GEMINI_API_KEY=your_key
# ELEVENLABS_API_KEY=your_key
```

### 3. Start Required Databases
```bash
# VectorAI DB (Qdrant) - runs on ports 6573/6574
docker run -d -p 6573:6333 -p 6574:6334 qdrant/qdrant:latest

# Actian Vector - runs on port 5432 (ODBC)
docker run -d -p 5432:5432 actian/vector5.0:community
```

### 4. Test Individual Servers
```bash
# Test VectorAI DB
python mcp/vectorai_db_mcp.py

# Test Embedder
python mcp/embedder_mcp.py

# Test Gemini (requires API key)
python mcp/gemini_mcp.py

# Test ElevenLabs (requires API key)
python mcp/elevenlabs_mcp.py

# Test Vector Analytics (requires Actian Vector)
python mcp/vector_analytics_mcp.py
```

### 5. Use with MCP Client
Add `mcp/mcp_config.json` to your MCP client configuration (e.g., Cursor, Cline, etc.)

## Tool Usage Examples

### VectorAI DB - Semantic Search
```json
{
  "name": "vectorai_search_similar",
  "arguments": {
    "query_vector": [0.1, 0.2, ...],  // 384-dim vector from embedder
    "limit": 3,
    "collection_name": "lecture_chunks"
  }
}
```

### Vector Analytics - Pensieve Query
```json
{
  "name": "vector_top_moments",
  "arguments": {
    "lecture_id": 1,
    "limit": 3
  }
}
```

### Embedder - Encode with Latency
```json
{
  "name": "embedder_encode_with_latency",
  "arguments": {
    "text": "The chain rule computes derivatives of composite functions"
  }
}
```

### Gemini - Rewrite Analogy
```json
{
  "name": "gemini_rewrite_analogy",
  "arguments": {
    "concept_node": "chain rule",
    "original_text": "The chain rule computes derivatives of composite functions by multiplying the derivative of the outer function by the derivative of the inner function.",
    "avatar": "cricketer"
  }
}
```

### ElevenLabs - Text to Speech
```json
{
  "name": "elevenlabs_text_to_speech",
  "arguments": {
    "text": "Think of the chain rule like a cricket bowling action...",
    "voice_id": "21m00Tcm4TlvDq8ikWAM"
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (LLM)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP Protocol (stdio)
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ VectorAI DB   │  │ Vector        │  │ Embedder      │
│ (Qdrant)      │  │ Analytics     │  │ (bge-small)   │
│ :6574 gRPC    │  │ (ODBC :5432)  │  │ CPU           │
└───────────────┘  └───────────────┘  └───────────────┘
        ▲                  ▲
        │                  │
┌───────────────┐  ┌───────────────┐
│ Gemini        │  │ ElevenLabs    │
│ (Cloud API)   │  │ (Cloud API)   │
└───────────────┘  └───────────────┘
```

## Requirements

- Python 3.11+
- `mcp` package
- `qdrant-client` (VectorAI DB)
- `pyodbc` + Actian Vector ODBC driver (Vector Analytics)
- `sentence-transformers` + `torch` (Embedder)
- `google-genai` (Gemini)
- `elevenlabs` (ElevenLabs)

## Notes

- **No hardware demo required** - These MCP servers work with the website showcase and PPT presentation
- **Graceful degradation** - Cloud services (Gemini, ElevenLabs) return fallback responses when API keys are missing
- **Local-first** - Embedder and VectorAI DB run entirely on-prem