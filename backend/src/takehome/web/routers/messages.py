from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from takehome.db.models import Message
from takehome.db.session import get_session
from takehome.services.conversation import get_conversation, update_conversation
from takehome.services.document import get_documents_for_conversation
from takehome.services.llm import chat_with_document, count_sources_cited, generate_title

logger = structlog.get_logger()

router = APIRouter(tags=["messages"])


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #


class CitationOut(BaseModel):
    quote: str | None
    document: str
    page: int | None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources_cited: int
    sources: list[str] = []
    citation: CitationOut | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @validator("sources", pre=True, always=True)
    @classmethod
    def parse_sources(cls, v: object) -> list[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []

    @validator("citation", pre=True, always=True)
    @classmethod
    def parse_citation(cls, v: object) -> CitationOut | None:
        if isinstance(v, str):
            try:
                data = json.loads(v)
                return CitationOut(
                    quote=data.get("quote"),
                    document=data.get("document", ""),
                    page=data.get("page"),
                )
            except Exception:
                return None
        return v


class MessageCreate(BaseModel):
    content: str


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@router.get(
    "/api/conversations/{conversation_id}/messages",
    response_model=list[MessageOut],
)
async def list_messages(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    """List all messages in a conversation, ordered by creation time."""
    # Verify the conversation exists
    conversation = await get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    result = await session.execute(stmt)
    messages = list(result.scalars().all())

    return [
        MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            sources_cited=m.sources_cited,
            sources=m.sources,
            citation=m.citation,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/api/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Send a user message and stream back the AI response via SSE."""
    # Verify the conversation exists
    conversation = await get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save the user message
    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=body.content,
    )
    session.add(user_message)
    await session.commit()
    await session.refresh(user_message)

    logger.info("User message saved", conversation_id=conversation_id, message_id=user_message.id)

    # Load all documents for the conversation
    all_docs = await get_documents_for_conversation(session, conversation_id)
    documents_context = [
        {"filename": d.filename, "text": d.extracted_text}
        for d in all_docs
        if d.extracted_text
    ]

    # Load conversation history (exclude the message we just saved)
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.id != user_message.id)
        .order_by(Message.created_at.asc())
    )
    result = await session.execute(stmt)
    history_messages = list(result.scalars().all())

    conversation_history: list[dict[str, str]] = [
        {"role": m.role, "content": m.content} for m in history_messages
    ]

    # Determine if this is the first user message (for title generation)
    user_msg_count = sum(1 for m in history_messages if m.role == "user")
    is_first_message = user_msg_count == 0

    async def event_stream() -> AsyncIterator[str]:
        """Generate SSE events with the streamed LLM response."""
        full_response = ""

        try:
            async for chunk in chat_with_document(
                user_message=body.content,
                documents=documents_context,
                conversation_history=conversation_history,
            ):
                full_response += chunk
                event_data = json.dumps({"type": "content", "content": chunk})
                yield f"data: {event_data}\n\n"

        except Exception:
            logger.exception(
                "Error during LLM streaming",
                conversation_id=conversation_id,
            )
            error_msg = "I'm sorry, an error occurred while generating a response. Please try again."
            full_response = error_msg
            event_data = json.dumps({"type": "content", "content": error_msg})
            yield f"data: {event_data}\n\n"

        # Parse and strip the [SOURCES: {...}] block from the response
        sources: list[str] = []
        sources_match = re.search(r"\[SOURCES:\s*(\{.*?\})\]", full_response, re.DOTALL)
        if sources_match:
            try:
                sources = json.loads(sources_match.group(1)).get("documents", [])
            except (json.JSONDecodeError, AttributeError):
                sources = []
            full_response = full_response[: sources_match.start()].rstrip()

        # Parse and strip the [CITATION: {...}] block from the response
        citation_json: str | None = None
        citation_match = re.search(r"\[CITATION:\s*(\{.*?\})\]", full_response, re.DOTALL)
        if citation_match:
            try:
                citation_data = json.loads(citation_match.group(1))
                if citation_data.get("quote") is not None:
                    citation_json = json.dumps(citation_data)
            except (json.JSONDecodeError, AttributeError):
                pass
            full_response = full_response[: citation_match.start()].rstrip()

        # Count sources cited in the full response
        sources_count = count_sources_cited(full_response)

        # Save the assistant message to the database.
        from takehome.db.session import async_session as session_factory

        async with session_factory() as save_session:
            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_response,
                sources_cited=sources_count,
                sources=json.dumps(sources) if sources else None,
                citation=citation_json,
            )
            save_session.add(assistant_message)
            await save_session.commit()
            await save_session.refresh(assistant_message)

            # Auto-generate title from first user message
            if is_first_message:
                try:
                    title = await generate_title(body.content)
                    await update_conversation(save_session, conversation_id, title)
                    logger.info(
                        "Auto-generated conversation title",
                        conversation_id=conversation_id,
                        title=title,
                    )
                except Exception:
                    logger.exception(
                        "Failed to generate title",
                        conversation_id=conversation_id,
                    )

            # Build citation dict for the SSE event
            citation_dict = None
            if citation_json:
                try:
                    citation_dict = json.loads(citation_json)
                except Exception:
                    pass

            # Send the final message event with the complete assistant message
            message_data = json.dumps(
                {
                    "type": "message",
                    "message": {
                        "id": assistant_message.id,
                        "conversation_id": assistant_message.conversation_id,
                        "role": assistant_message.role,
                        "content": assistant_message.content,
                        "sources_cited": assistant_message.sources_cited,
                        "sources": sources,
                        "citation": citation_dict,
                        "created_at": assistant_message.created_at.isoformat(),
                    },
                }
            )
            yield f"data: {message_data}\n\n"

            # Send the done signal
            done_data = json.dumps(
                {
                    "type": "done",
                    "sources_cited": sources_count,
                    "message_id": assistant_message.id,
                }
            )
            yield f"data: {done_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
