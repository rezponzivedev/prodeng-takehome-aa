from __future__ import annotations

import re
from collections.abc import AsyncIterator

from pydantic_ai import Agent

from takehome.config import settings  # noqa: F401 — triggers ANTHROPIC_API_KEY export

agent = Agent(
    "anthropic:claude-haiku-4-5-20251001",
    system_prompt=(
        "You are a helpful legal document assistant for commercial real estate lawyers. "
        "You help lawyers review and understand documents during due diligence.\n\n"
        "IMPORTANT INSTRUCTIONS:\n"
        "- Answer questions based on the document content provided.\n"
        "- Multiple documents may be provided. When answering, clearly attribute which document "
        "each piece of information comes from, using the document's filename.\n"
        "- When referencing specific parts of a document, cite the filename and the relevant section or clause.\n"
        "- If the answer is not in the documents, say so clearly. Do not fabricate information.\n"
        "- Be concise and precise. Lawyers value accuracy over verbosity.\n"
        "- At the very end of every response, on a new line, append a JSON block in exactly this "
        'format and nothing else after it: [SOURCES: {"documents": ["filename1.pdf"]}] '
        "listing only the document filenames you actually referenced to answer the question. "
        "Do not include documents you did not use.\n"
        "- On a new line immediately after the SOURCES block, append a single citation block in "
        "exactly this format: "
        '[CITATION: {"quote": "verbatim passage", "document": "exact filename", "page": 3}]\n'
        "Citation rules:\n"
        "  * quote must be copied verbatim from the document text — never paraphrase.\n"
        "  * document must be the exact filename as provided.\n"
        "  * page should be your best estimate of the page number based on document position.\n"
        "  * Only include the single most directly supporting passage — one citation per response.\n"
        '  * If the answer cannot be grounded in a specific passage, use: [CITATION: {"quote": null, "document": "filename", "page": null}]'
    ),
)


async def generate_title(user_message: str) -> str:
    """Generate a 3-5 word conversation title from the first user message."""
    result = await agent.run(
        f"Generate a concise 3-5 word title for a conversation that starts with: '{user_message}'. "
        "Return only the title, nothing else."
    )
    title = str(result.output).strip().strip('"').strip("'")
    # Truncate if too long
    if len(title) > 100:
        title = title[:97] + "..."
    return title


async def chat_with_document(
    user_message: str,
    documents: list[dict[str, str]],
    conversation_history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Stream a response to the user's message, yielding text chunks.

    Builds a prompt that includes document context and conversation history,
    then streams the response from the LLM.

    Each entry in `documents` should have "filename" and "text" keys.
    """
    # Build the full prompt with context
    prompt_parts: list[str] = []

    # Add document context if available
    if documents:
        prompt_parts.append(
            f"The following {len(documents)} document(s) are available:\n\n"
        )
        for i, doc in enumerate(documents, 1):
            prompt_parts.append(
                f'<document index="{i}" filename="{doc["filename"]}">\n'
                f'{doc["text"]}\n'
                f"</document>\n"
            )
        prompt_parts.append(
            "When citing content, reference the document by filename and section/page.\n\n"
        )
    else:
        prompt_parts.append(
            "No documents have been uploaded yet. If the user asks about a document, "
            "let them know they need to upload one first.\n"
        )

    # Add conversation history
    if conversation_history:
        prompt_parts.append("Previous conversation:\n")
        for msg in conversation_history:
            role = msg["role"]
            content = msg["content"]
            if role == "user":
                prompt_parts.append(f"User: {content}\n")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}\n")
        prompt_parts.append("\n")

    # Add the current user message
    prompt_parts.append(f"User: {user_message}")

    full_prompt = "\n".join(prompt_parts)

    async with agent.run_stream(full_prompt) as result:
        async for text in result.stream_text(delta=True):
            yield text


def count_sources_cited(response: str) -> int:
    """Count the number of references to document sections, clauses, pages, etc."""
    patterns = [
        r"section\s+\d+",
        r"clause\s+\d+",
        r"page\s+\d+",
        r"paragraph\s+\d+",
    ]
    count = 0
    for pattern in patterns:
        count += len(re.findall(pattern, response, re.IGNORECASE))
    return count
