"""Video recommendations router — suggests educational YouTube videos for confused concepts.

Uses YouTube Data API v3 search when a YOUTUBE_API_KEY is configured,
falls back to curated recommendations for common ML/math concepts.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/videos", tags=["videos"])


class VideoResult(BaseModel):
    title: str
    url: str
    thumbnail: str = ""
    channel: str = ""
    description: str = ""
    source: str = "curated"  # "youtube_api" | "curated" | "search_link"


class VideoResponse(BaseModel):
    concept: str
    videos: list[VideoResult]
    source: str = "curated"


# ─── Curated video database for common topics ─────────────────────

CURATED_VIDEOS: dict[str, list[dict]] = {
    "backpropagation": [
        {
            "title": "Backpropagation calculus | Chapter 4, Deep learning",
            "url": "https://www.youtube.com/watch?v=tIeHLnjs5U8",
            "thumbnail": "https://i.ytimg.com/vi/tIeHLnjs5U8/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "Visual intuition for how backpropagation actually computes gradients.",
        },
        {
            "title": "But what is backpropagation really doing? | Chapter 3",
            "url": "https://www.youtube.com/watch?v=Ilg3gGewQ5U",
            "thumbnail": "https://i.ytimg.com/vi/Ilg3gGewQ5U/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "A deeper dive into the intuition behind backpropagation.",
        },
        {
            "title": "Backpropagation — Neural Networks for Machine Learning",
            "url": "https://www.youtube.com/watch?v=LOc_y67AzCA",
            "thumbnail": "https://i.ytimg.com/vi/LOc_y67AzCA/hqdefault.jpg",
            "channel": "Geoffrey Hinton (Coursera)",
            "description": "Geoffrey Hinton's explanation of the backpropagation algorithm.",
        },
    ],
    "backprop": [
        {
            "title": "Backpropagation calculus | Chapter 4, Deep learning",
            "url": "https://www.youtube.com/watch?v=tIeHLnjs5U8",
            "thumbnail": "https://i.ytimg.com/vi/tIeHLnjs5U8/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "Visual intuition for how backpropagation actually computes gradients.",
        },
    ],
    "gradient descent": [
        {
            "title": "Gradient descent, how neural networks learn | Chapter 2",
            "url": "https://www.youtube.com/watch?v=IHZwWFHWa-w",
            "thumbnail": "https://i.ytimg.com/vi/IHZwWFHWa-w/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "How neural networks learn via gradient descent.",
        },
        {
            "title": "Stochastic Gradient Descent, Clearly Explained",
            "url": "https://www.youtube.com/watch?v=vMh0zPT0tLI",
            "thumbnail": "https://i.ytimg.com/vi/vMh0zPT0tLI/hqdefault.jpg",
            "channel": "StatQuest",
            "description": "Josh Starmer breaks down SGD with step-by-step clarity.",
        },
    ],
    "chain rule": [
        {
            "title": "Chain rule | Essence of calculus, chapter 4",
            "url": "https://www.youtube.com/watch?v=YG15m2VwSjA",
            "thumbnail": "https://i.ytimg.com/vi/YG15m2VwSjA/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "Beautiful visual walkthrough of the chain rule.",
        },
        {
            "title": "Chain Rule For Finding Derivatives",
            "url": "https://www.youtube.com/watch?v=HaHsqDjWMLU",
            "thumbnail": "https://i.ytimg.com/vi/HaHsqDjWMLU/hqdefault.jpg",
            "channel": "The Organic Chemistry Tutor",
            "description": "Step-by-step examples of applying the chain rule.",
        },
    ],
    "chain_rule": [
        {
            "title": "Chain rule | Essence of calculus, chapter 4",
            "url": "https://www.youtube.com/watch?v=YG15m2VwSjA",
            "thumbnail": "https://i.ytimg.com/vi/YG15m2VwSjA/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "Beautiful visual walkthrough of the chain rule.",
        },
    ],
    "neural network": [
        {
            "title": "But what is a neural network? | Chapter 1, Deep learning",
            "url": "https://www.youtube.com/watch?v=aircAruvnKk",
            "thumbnail": "https://i.ytimg.com/vi/aircAruvnKk/hqdefault.jpg",
            "channel": "3Blue1Brown",
            "description": "The best visual introduction to neural networks.",
        },
        {
            "title": "Neural Networks Explained in 5 Minutes",
            "url": "https://www.youtube.com/watch?v=jmmW0F0biz0",
            "thumbnail": "https://i.ytimg.com/vi/jmmW0F0biz0/hqdefault.jpg",
            "channel": "Simplilearn",
            "description": "Quick overview of how neural networks work.",
        },
    ],
    "loss function": [
        {
            "title": "Loss Functions Explained",
            "url": "https://www.youtube.com/watch?v=QBbC3Cjhvbo",
            "thumbnail": "https://i.ytimg.com/vi/QBbC3Cjhvbo/hqdefault.jpg",
            "channel": "Weights & Biases",
            "description": "What loss functions are and why they matter.",
        },
    ],
    "activation function": [
        {
            "title": "Activation Functions in Neural Networks",
            "url": "https://www.youtube.com/watch?v=-7scQpJT7uo",
            "thumbnail": "https://i.ytimg.com/vi/-7scQpJT7uo/hqdefault.jpg",
            "channel": "StatQuest",
            "description": "ReLU, Sigmoid, Tanh — when and why to use each.",
        },
    ],
}


@router.get("/recommend/{concept}", response_model=VideoResponse)
async def recommend_videos(
    concept: str,
    max_results: int = 3,
) -> VideoResponse:
    """Get educational video recommendations for a concept.

    Uses curated recommendations for known concepts,
    generates YouTube search links for unknown ones.
    """
    normalized = concept.lower().strip().replace("_", " ")

    # Check curated database
    if normalized in CURATED_VIDEOS:
        videos = [
            VideoResult(**v)
            for v in CURATED_VIDEOS[normalized][:max_results]
        ]
        return VideoResponse(concept=concept, videos=videos, source="curated")

    # Partial match: check if any curated key is a substring
    for key, vids in CURATED_VIDEOS.items():
        if key in normalized or normalized in key:
            videos = [VideoResult(**v) for v in vids[:max_results]]
            return VideoResponse(concept=concept, videos=videos, source="curated")

    # Fallback: return YouTube search link
    search_query = concept.replace(" ", "+") + "+explained+tutorial"
    videos = [
        VideoResult(
            title=f"Search YouTube: {concept} explained",
            url=f"https://www.youtube.com/results?search_query={search_query}",
            channel="YouTube Search",
            description=f"Find videos about {concept} on YouTube.",
            source="search_link",
        )
    ]
    return VideoResponse(concept=concept, videos=videos, source="search_link")
