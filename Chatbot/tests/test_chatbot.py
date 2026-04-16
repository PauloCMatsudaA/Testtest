import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.chat_service import generate_response, conversation_histories
from app.rag.retriever import retrieve

def test_retrieve_returns_list():
    with patch("app.rag.retriever._load_index_and_metadata") as mock_load:
        mock_load.return_value = (None, None)
        result = retrieve("teste")
        assert isinstance(result, list)
        assert result == []

def test_retrieve_with_mock_index():
    import numpy as np
    mock_index = MagicMock()
    mock_index.search.return_value = (np.array([[0.9, 0.8]]), np.array([[0, 1]]))
    mock_metadata = [
        {"text": "EPI é equipamento de proteção individual", "chunk_id": 0},
        {"text": "Capacete protege a cabeça", "chunk_id": 1},
    ]

    with patch("app.rag.retriever._load_index_and_metadata") as mock_load:
        mock_load.return_value = (mock_index, mock_metadata)
        with patch("app.rag.retriever.client.embeddings.create") as mock_embed:
            mock_response = MagicMock()
            mock_response.data = [MagicMock(embedding=[0.1] * 1536)]
            mock_embed.return_value = mock_response

            results = retrieve("o que é EPI?", top_k=2)

            assert len(results) == 2
            assert "EPI é equipamento de proteção individual" in results

@pytest.mark.asyncio
async def test_generate_response_creates_history():
    session_id = "test_session_unit"
    if session_id in conversation_histories:
        del conversation_histories[session_id]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "Resposta de teste"

    with patch("app.services.chat_service.client.chat.completions.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_response
        with patch("app.services.chat_service.retrieve") as mock_retrieve:
            mock_retrieve.return_value = []

            response = await generate_response("O que é EPI?", session_id)

            assert response == "Resposta de teste"
            assert session_id in conversation_histories
            assert len(conversation_histories[session_id]) == 2

@pytest.mark.asyncio
async def test_conversation_history_truncation():
    session_id = "test_truncation"
    conversation_histories[session_id] = [{"role": "user", "content": f"msg {i}"} for i in range(20)]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "OK"

    with patch("app.services.chat_service.client.chat.completions.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_response
        with patch("app.services.chat_service.retrieve") as mock_retrieve:
            mock_retrieve.return_value = []
            await generate_response("mais uma", session_id)
            assert len(conversation_histories[session_id]) <= 20
