"""Seed knowledge base with real chunks."""
import os
import sys
import time
import httpx
from pathlib import Path

# Add backend to path so we can import modules
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from services.embedder import Embedder
from services.vectorai_client import VectorAIClient

def main():
    print("Initializing embedder...")
    t0 = time.time()
    embedder = Embedder()
    print(f"Embedder initialized in {time.time() - t0:.2f}s")
    
    print("Initializing VectorAI DB client...")
    t0 = time.time()
    vectorai = VectorAIClient()
    print(f"VectorAI DB initialized in {time.time() - t0:.2f}s")

    chunks = [
        {
            "topic_node": "backpropagation",
            "text": "Backpropagation is an algorithm used to train neural networks. It calculates the gradient of the loss function with respect to the weights of the network, which is then used by optimization algorithms like gradient descent to update the weights.",
            "ts": 10.0,
            "difficulty": 6,
        },
        {
            "topic_node": "chain_rule",
            "text": "The chain rule in calculus is the core mathematical principle behind backpropagation. It allows us to compute the derivative of a composite function by multiplying the derivatives of each constituent function layer by layer.",
            "ts": 25.0,
            "difficulty": 8,
        },
        {
            "topic_node": "gradient_descent",
            "text": "Gradient descent is an optimization algorithm used to minimize the loss function. It works by iteratively taking steps in the direction of steepest descent, which is given by the negative of the gradient.",
            "ts": 40.0,
            "difficulty": 5,
        },
        {
            "topic_node": "neural_networks",
            "text": "Neural networks are computing systems inspired by the biological neural networks that constitute animal brains. They consist of layers of interconnected nodes, or neurons, that process input data to produce an output.",
            "ts": 5.0,
            "difficulty": 3,
        },
        {
            "topic_node": "learning_rate",
            "text": "The learning rate is a hyperparameter that determines the step size at each iteration while moving toward a minimum of a loss function. If it's too high, the model might overshoot the minimum; if it's too low, training will be very slow.",
            "ts": 55.0,
            "difficulty": 4,
        }
    ]

    points = []
    for i, chunk in enumerate(chunks):
        t0 = time.time()
        vector, _ = embedder.encode_with_latency(chunk["text"])
        emb_ms = (time.time() - t0) * 1000
        
        point_id = f"demo_chunk_{i}"
        
        point = {
            "id": point_id,
            "vector": vector,
            "payload": {
                "topic_node": chunk["topic_node"],
                "lecture_id": 1,
                "ts": chunk["ts"],
                "text": chunk["text"],
                "source": "live_lecture",
                "difficulty": chunk["difficulty"],
            }
        }
        points.append(point)
        print(f"Embedded chunk '{chunk['topic_node']}' in {emb_ms:.1f}ms")

    # Upsert to DB
    t0 = time.time()
    vectorai.upsert(points)
    print(f"Upserted {len(points)} points to VectorAI DB in {time.time() - t0:.2f}s")

    # POST to /asr/ingest-chunk
    print("POSTing chunks to /asr/ingest-chunk...")
    with httpx.Client(base_url="http://localhost:8001") as client:
        for chunk in chunks:
            t0 = time.time()
            payload = {
                "text": chunk["text"],
                "topic_node": chunk["topic_node"],
                "lecture_id": 1,
                "ts": chunk["ts"],
                "difficulty": chunk["difficulty"],
                "source": "live_lecture"
            }
            try:
                resp = client.post("/asr/ingest-chunk", json=payload)
                resp.raise_for_status()
                print(f"POST {chunk['topic_node']} success in {time.time() - t0:.2f}s")
            except Exception as e:
                print(f"POST {chunk['topic_node']} failed: {e}")

if __name__ == "__main__":
    main()
