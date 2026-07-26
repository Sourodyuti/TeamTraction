import asyncio
import json
from services.embedder import Embedder
from services.vectorai_client import VectorAIClient
from services.hybrid_search import BM25Index, HybridSearchEngine, set_hybrid_engine
from services.knowledge_base import get_knowledge_base
from models.schemas import SearchMode, HybridSearchRequest
from routers.retrieval import hybrid_search
from dependencies import set_embedder, set_vectorai

async def run():
    print("🔧 Initializing Legilimens Advanced Search Engine...")
    emb = Embedder()
    vdb = VectorAIClient()
    vdb.connect()
    
    # Initialize the BM25 + RRF Hybrid Engine
    bm25 = BM25Index()
    hybrid = HybridSearchEngine(vdb, emb, bm25)
    
    # Inject dependencies for the routers and knowledge base
    set_embedder(emb)
    set_vectorai(vdb)
    set_hybrid_engine(hybrid)
    
    kb = get_knowledge_base()
    
    print("\n📚 Indexing mock lecture chunks into VectorAI (Semantic) + BM25 (Keyword)...")
    chunks = [
        ("c1", "The chain rule is essential for calculating derivatives during backpropagation in deep neural networks.", "deep_learning", 8),
        ("c2", "Gradient descent uses the derivative to iteratively step towards the minimum of a cost function.", "optimization", 6),
        ("c3", "A simple neural network architecture consists of an input layer, hidden layers, and an output layer.", "basics", 3),
        ("c4", "This is an unrelated textbook example about calculating the trajectory of apples falling from a tree.", "physics", 2)
    ]
    
    for cid, text, topic, diff in chunks:
        # This will auto-index into both the semantic database AND our new BM25 engine
        success = kb.index_chunk(lecture_id=101, chunk_id=cid, text=text, ts=0.0, topic_node=topic, difficulty=diff)
        if success:
            print(f"  ✅ Indexed: [{topic}] (Difficulty {diff}) -> {text[:40]}...")
            
    print("\n============================================================")
    print("🔍 1. HYBRID FUSION SEARCH (Semantic + BM25 Keyword)")
    print("Query: 'chain rule backpropagation derivatives'")
    req_hybrid = HybridSearchRequest(
        query_text="chain rule backpropagation derivatives",
        mode=SearchMode.HYBRID,
        limit=2,
        alpha=0.5 # 50/50 weighting
    )
    res_hybrid = await hybrid_search(req_hybrid)
    
    for i, hit in enumerate(res_hybrid.results, 1):
        print(f"\n  Result {i}: {hit.text}")
        print(f"  Scores -> Final RRF: {hit.score:.4f} | Semantic Score: {hit.semantic_score:.4f} | Keyword Score: {hit.keyword_score:.4f}")
        print(f"  Metadata -> Topic: {hit.topic_node} | Source: {hit.source}")
        
    print("\n============================================================")
    print("🔍 2. FILTERED SEARCH (Vector + Structured Payload Filters)")
    print("Query: 'neural network layers'")
    print("Filters: topic_node = 'basics', difficulty_max = 4")
    req_filtered = HybridSearchRequest(
        query_text="neural network layers",
        mode=SearchMode.FILTERED,
        limit=2,
        topic_node="basics",
        difficulty_max=4
    )
    res_filtered = await hybrid_search(req_filtered)
    
    for i, hit in enumerate(res_filtered.results, 1):
        print(f"\n  Result {i}: {hit.text}")
        print(f"  Scores -> Final: {hit.score:.4f} | Semantic Score: {hit.semantic_score:.4f}")
        print(f"  Metadata -> Topic: {hit.topic_node} | Difficulty: {hit.payload.get('difficulty')}")

    print("\n============================================================")

if __name__ == "__main__":
    asyncio.run(run())
