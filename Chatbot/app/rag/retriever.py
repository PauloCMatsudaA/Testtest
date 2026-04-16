import json
import os
import numpy as np
import faiss
from functools import lru_cache
from openai import OpenAI
from app.core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)
EMBEDDING_MODEL = "text-embedding-3-small"

@lru_cache(maxsize=1)
def _load_index_and_metadata():
    index_path = settings.RAG_INDEX_PATH
    faiss_file = os.path.join(index_path, "index.faiss")
    metadata_file = os.path.join(index_path, "metadata.json")

    if not os.path.exists(faiss_file) or not os.path.exists(metadata_file):
        return None, None

    index = faiss.read_index(faiss_file)
    with open(metadata_file, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    return index, metadata

def retrieve(query: str, top_k: int = None) -> list[str]:
    if top_k is None:
        top_k = settings.RAG_TOP_K

    index, metadata = _load_index_and_metadata()
    if index is None:
        return []

    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=[query]
    )
    query_embedding = np.array([response.data[0].embedding], dtype=np.float32)
    faiss.normalize_L2(query_embedding)

    distances, indices = index.search(query_embedding, top_k)

    results = []
    for idx in indices[0]:
        if idx != -1 and idx < len(metadata):
            results.append(metadata[idx]["text"])

    return results
