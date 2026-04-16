from openai import AsyncOpenAI
from app.core.config import settings
from app.rag.retriever import retrieve

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

conversation_histories: dict[str, list] = {}

SYSTEM_PROMPT = """Você é um assistente especializado na Norma Regulamentadora 6 (NR-6) do Ministério do Trabalho e Emprego do Brasil, que trata de Equipamentos de Proteção Individual (EPIs).

Sua função é:
1. Responder perguntas sobre EPIs, suas obrigações legais, tipos, usos corretos e normas
2. Ajudar trabalhadores e gestores a entender seus direitos e deveres relativos aos EPIs
3. Fornecer informações precisas baseadas na NR-6 e documentos relacionados

Diretrizes:
- Seja claro, objetivo e use linguagem acessível
- Cite a NR-6 quando relevante
- Se não souber algo, diga que não tem certeza
- Responda sempre em português
- Mantenha respostas concisas mas completas"""

async def generate_response(user_message: str, session_id: str) -> str:
    if session_id not in conversation_histories:
        conversation_histories[session_id] = []

    history = conversation_histories[session_id]

    context_chunks = retrieve(user_message)
    context_text = ""
    if context_chunks:
        context_text = "\n\nContexto relevante da NR-6:\n" + "\n---\n".join(context_chunks)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + context_text},
        *history,
        {"role": "user", "content": user_message}
    ]

    response = await client.chat.completions.create(
        model=settings.CHATBOT_MODEL,
        messages=messages,
        max_tokens=settings.CHATBOT_MAX_TOKENS,
        temperature=settings.CHATBOT_TEMPERATURE
    )

    assistant_message = response.choices[0].message.content

    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": assistant_message})

    if len(history) > 20:
        conversation_histories[session_id] = history[-20:]

    return assistant_message
