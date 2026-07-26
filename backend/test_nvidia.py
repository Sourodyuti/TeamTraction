import asyncio
import httpx
import base64
import os
from dotenv import load_dotenv

load_dotenv()

async def test_nvidia():
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        print("No NVIDIA_API_KEY")
        return
        
    # dummy tiny image 1x1 png
    b64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "meta/llama-3.2-90b-vision-instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What is in this image?"},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_image}"}}
                ]
            }
        ],
        "max_tokens": 512,
        "temperature": 0.0
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=15.0
        )
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            print("Response:", resp.json()["choices"][0]["message"]["content"])
        else:
            print("Error:", resp.text)

asyncio.run(test_nvidia())
