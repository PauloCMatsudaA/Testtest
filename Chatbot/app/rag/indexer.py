import json
import os
import numpy as np
import faiss
from openai import OpenAI
from app.core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

def load_chunks(chunks_path: str) -> list[dict]:
    chunks = []
    for filename in os.listdir(chunks_path):
        if filename.endswith(".json"):
            filepath = os.path.join(chunks_path, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    chunks.extend(data)
                elif isinstance(data, dict):
                    chunks.append(data)
    return chunks

def get_embeddings(texts: list[str]) -> np.ndarray:
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    embeddings = [item.embedding for item in response.data]
    return np.array(embeddings, dtype=np.float32)

def build_index(chunks_path: str, index_path: str):
    print(f"Loading chunks from {chunks_path}...")
    chunks = load_chunks(chunks_path)
    print(f"Loaded {len(chunks)} chunks")

    texts = [chunk.get("text", "") or chunk.get("content", "") for chunk in chunks]
    texts = [t for t in texts if t.strip()]

    print("Generating embeddings...")
    batch_size = 100
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = get_embeddings(batch)
        all_embeddings.append(embeddings)
        print(f"  Processed {min(i + batch_size, len(texts))}/{len(texts)} chunks")

    all_embeddings = np.vstack(all_embeddings)

    index = faiss.IndexFlatIP(EMBEDDING_DIM)
    faiss.normalize_L2(all_embeddings)
    index.add(all_embeddings)

    os.makedirs(index_path, exist_ok=True)
    faiss.write_index(index, os.path.join(index_path, "index.faiss"))

    metadata = [{"text": texts[i], "chunk_id": i} for i in range(len(texts))]
    with open(os.path.join(index_path, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"Index built with {len(texts)} vectors and saved to {index_path}")

if __name__ == "__main__":
    build_index(
        chunks_path=settings.RAG_CHUNKS_PATH,
        index_path=settings.RAG_INDEX_PATH
    )
