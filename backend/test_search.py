import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def print_response(title, response):
    print(f"\n{'='*50}")
    print(f"--- {title} ---")
    if response.status_code == 200:
        data = response.json()
        print(f"Mode: {data.get('mode')}")
        print(f"Total Results: {data.get('total_results')}")
        print(f"Latency: {data.get('latency_ms')}")
        print("\nTop Results:")
        for i, res in enumerate(data.get('results', [])[:3], 1):
            print(f"  {i}. [Score: {res.get('score'):.4f}] (Topic: {res.get('topic_node', 'N/A')})")
            print(f"     Text: {res.get('text', '')[:100]}...")
            if 'semantic_score' in res and 'keyword_score' in res:
                print(f"     -> Semantic: {res.get('semantic_score')}, Keyword: {res.get('keyword_score')}")
    else:
        print(f"Error {response.status_code}: {response.text}")
    print(f"{'='*50}\n")


def run_demo():
    print("Checking if server is up...")
    try:
        health = requests.get(f"{BASE_URL}/health").json()
        print(f"Server is up! Services: {health.get('services')}")
    except Exception as e:
        print(f"Failed to connect to server at {BASE_URL}. Please start the server first with 'uvicorn main:app --reload'")
        return

    # 1. Hybrid Search Demo
    payload_hybrid = {
        "query_text": "How does backpropagation relate to the chain rule?",
        "mode": "hybrid",
        "limit": 5,
        "alpha": 0.5  # 50% semantic, 50% keyword
    }
    r_hybrid = requests.post(f"{BASE_URL}/retrieval/search", json=payload_hybrid)
    print_response("1. HYBRID FUSION SEARCH (Semantic + BM25 Keyword)", r_hybrid)

    # 2. Filtered Search Demo
    payload_filtered = {
        "query_text": "Explain neural networks",
        "mode": "filtered",
        "limit": 5,
        "difficulty_min": 2,
        "difficulty_max": 5,
        "topic_node": "deep_learning"
    }
    r_filtered = requests.post(f"{BASE_URL}/retrieval/search", json=payload_filtered)
    print_response("2. FILTERED SEARCH (Vector + Structured Filters)", r_filtered)

    # 3. Pure Semantic Search Demo
    payload_semantic = {
        "query_text": "What is gradient descent?",
        "mode": "semantic",
        "limit": 5
    }
    r_semantic = requests.post(f"{BASE_URL}/retrieval/search", json=payload_semantic)
    print_response("3. PURE SEMANTIC SEARCH", r_semantic)
    
    # 4. Pure Keyword Search Demo
    payload_keyword = {
        "query_text": "gradient descent",
        "mode": "keyword",
        "limit": 5
    }
    r_keyword = requests.post(f"{BASE_URL}/retrieval/search", json=payload_keyword)
    print_response("4. PURE KEYWORD (BM25) SEARCH", r_keyword)

if __name__ == "__main__":
    run_demo()
