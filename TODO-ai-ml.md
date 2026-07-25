# ✅ TODO — Member 2: AI / ML Lead

> **Branch:** `dev/ai-ml` · **Owns:** `backend/services/` (embedder, gemini, elevenlabs, whisper, vectorai_client, vector_client), `data-prep/`
> **Coordinates with:** BE lead on service interfaces; PM lead on content (lecture transcript, textbook).
> **Never touch:** `backend/routers/`, `backend/models/schemas.py`, `backend/main.py`, `frontend/`, `docker-compose.yml`.

---

## Phase 0 — Verify Tooling (Hours 0–2)

- [x] `actian_vectorai` SDK installs and connects (report exact API surface to BE lead)
- [x] `pyodbc` connects to Actian Vector (report connection string format to BE lead)
- [x] `bge-small-en` model downloaded and loads
- [x] Verify embedder outputs 384-dim vectors: `len(encode("test")) == 384`
- [ ] **Exit gate:** all three (VectorAI SDK, Vector ODBC, bge-small) work standalone ✅

---

## Phase 1 — Data Foundation (Hours 2–4)

- [x] `services/embedder.py`: bge-small wrapper, `encode()` returns `list[list[float]]`, `encode_with_latency()` returns `(vector, ms)`
- [x] `services/vectorai_client.py`: `connect()`, `create_lecture_chunks_collection()`, `upsert_chunks()`, `search_similar()`, `close()`, `health()`
- [x] `data-prep/chunk_lecture.py`: split transcript into ~15s chunks, tag topic_node
- [x] `data-prep/load_textbook.py`: chunk textbook into paragraph-sized segments
- [x] `data-prep/sample_lecture.txt`: filled in with real backprop transcript
- [x] Embed + upsert lecture chunks into `lecture_chunks` with payload `{topic_node, ts, diff}`
- [x] Embed + upsert textbook chapter as the "knowledge vault"
- [x] `scripts/demo_setup.sh`: end-to-end data load (coordinate with BE lead on invocation)
- [x] Retrieval smoke test: "chain rule" returns the chain-rule explanation
- [ ] **Exit gate:** `search_similar()` returns sensible hits for 3 test queries ✅

---

## Phase 4 — Retrieval Support (Hours 9–12)

- [x] Confirm `vectorai_client.search_similar()` returns <50ms for a single query
- [x] Benchmark embedding latency with `encode_with_latency()` — should be <20ms on CPU
- [x] Tune similarity search params (limit, score threshold) for best demo hits
- [ ] **Exit gate:** retrieval latency <50ms measured ✅

---

## Phase 5 — Generative Rewrite / Gemino (Hours 12–15)

- [x] `services/gemini_client.py`: real Gemini API call (`google-genai` SDK, gemini-2.5-flash)
- [x] Prompt template: *"Rewrite this explanation as a 2-sentence analogy for a {cricketer/gamer/cook}."*
- [x] `rewrite_analogy(concept_node, original_text, avatar) -> (analogy_text, latency_ms)`
- [x] Fallback: if Gemini is slow/down, return the raw retrieved explanation (no crash)
- [x] Rate limiting + retry on 429/503
- [ ] Vet analogy quality on real examples with PM lead
- [ ] **Exit gate:** analogy reads naturally for ≥2 avatars ✅

---

## Phase 6 — Voice / Sonorus (Hours 15–17)

- [x] `services/elevenlabs_client.py`: real ElevenLabs TTS call
- [x] Select a calm tutor `voice_id` (test 3-5 voices, pick best)
- [x] `text_to_speech(text) -> (audio_bytes, latency_ms)` returns MP3 bytes
- [x] Handle API errors gracefully (quota, network) — return empty bytes + log, don't crash
- [x] Pre-generate audio for the cached offline analogy
- [ ] **Exit gate:** TTS produces playable audio <600ms ✅

---

## Phase 8 — Offline Cache (Hours 19–21)

- [x] Pre-cache one full analogy end-to-end: retrieve → Gemini → ElevenLabs → save to disk
- [x] Provide a function BE lead can call to serve the cached analogy when cloud is down
- [ ] **Exit gate:** cached analogy serves correctly when Ethernet is unplugged ✅

---

## Phase 10 — Rehearsal & Buffer (Hours 23–27)

- [ ] Fix latency spikes in Gemini / ElevenLabs
- [ ] Tune prompt for better analogies based on dry-run feedback
- [ ] Pre-generate all demo analogies as backup cache
- [ ] **Exit gate:** demo runs clean 3× ✅

---

## 🧪 Your Tests

- [x] `tests/test_embedder.py`: bge-small produces 384-dim vectors, encode_with_latency works
- [x] `tests/test_vectorai_client.py`: collection create/upsert/search (mock or integration)
- [x] `tests/test_gemini_client.py`: rewrite_analogy returns text + handles fallback (mock API)
- [x] `tests/test_elevenlabs_client.py`: text_to_speech returns bytes + handles errors (mock API)
- [x] `tests/test_data_prep.py`: chunk_lecture + load_textbook produce expected chunk count

---

## 🔌 Interface Contracts You Implement (others depend on these)

```python
# services/embedder.py — BE lead's retrieval router calls this
class Embedder:
    def encode(self, text: str | list[str]) -> list[list[float]]
    def encode_with_latency(self, text: str) -> tuple[list[float], float]  # (vector, ms)
    @property
    def dim(self) -> int  # always 384

# services/vectorai_client.py — BE lead's retrieval router calls this
class VectorAIClient:
    def connect(self) -> None
    def create_lecture_chunks_collection(self) -> None
    def upsert_chunks(self, points: list[dict]) -> None  # points: [{id, vector, payload}]
    def search_similar(self, query_vector: list[float], limit: int = 3) -> list[dict]
    def close(self) -> None
    def health(self) -> bool

# services/gemini_client.py — BE lead's retrieval router calls this
class GeminiClient:
    def rewrite_analogy(self, concept_node: str, original_text: str, avatar: InterestAvatar)
        -> tuple[str, float]  # (analogy_text, latency_ms)

# services/elevenlabs_client.py — BE lead's websocket router calls this
class ElevenLabsClient:
    def text_to_speech(self, text: str) -> tuple[bytes, float]  # (audio_bytes, latency_ms)
```