from __future__ import annotations

import os
import uuid

import fitz  # PyMuPDF
import structlog
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from takehome.config import settings
from takehome.db.models import Document

logger = structlog.get_logger()


async def upload_document(
    session: AsyncSession, conversation_id: str, file: UploadFile
) -> Document:
    """Upload and process a PDF document for a conversation.

    Validates the file is a PDF, saves it to disk, extracts text using PyMuPDF,
    and stores metadata in the database.

    Raises ValueError if the conversation already has a document or the file is not a PDF.
    """
    # Validate file type
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        filename = file.filename or ""
        if not filename.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are supported.")

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > settings.max_upload_size:
        raise ValueError(
            f"File too large. Maximum size is {settings.max_upload_size // (1024 * 1024)}MB."
        )

    # Generate a unique filename to avoid collisions
    original_filename = file.filename or "document.pdf"
    unique_name = f"{uuid.uuid4().hex}_{original_filename}"
    file_path = os.path.join(settings.upload_dir, unique_name)

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Save the file to disk
    with open(file_path, "wb") as f:
        f.write(content)

    logger.info("Saved uploaded PDF", filename=original_filename, path=file_path, size=len(content))

    # Extract text using PyMuPDF
    extracted_text = ""
    page_count = 0
    try:
        doc = fitz.open(file_path)
        page_count = len(doc)
        pages: list[str] = []
        for page_num in range(page_count):
            page = doc[page_num]
            text = page.get_text()  # type: ignore[union-attr]
            if text.strip():
                pages.append(f"--- Page {page_num + 1} ---\n{text}")
        extracted_text = "\n\n".join(pages)
        doc.close()
    except Exception:
        logger.exception("Failed to extract text from PDF", filename=original_filename)
        extracted_text = ""

    logger.info(
        "Extracted text from PDF",
        filename=original_filename,
        page_count=page_count,
        text_length=len(extracted_text),
    )

    # Create the document record
    document = Document(
        conversation_id=conversation_id,
        filename=original_filename,
        file_path=file_path,
        extracted_text=extracted_text if extracted_text else None,
        page_count=page_count,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return document


async def get_document(session: AsyncSession, document_id: str) -> Document | None:
    """Get a document by its ID."""
    stmt = select(Document).where(Document.id == document_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def delete_document(session: AsyncSession, document_id: str) -> bool:
    """Delete a document record and its file from disk. Returns True if deleted.

    The physical file is only removed when no other Document records share the
    same file_path (i.e. documents attached via attach_document).
    """
    from sqlalchemy import delete as sql_delete, func

    doc = await get_document(session, document_id)
    if doc is None:
        return False

    # Count how many documents share this file path
    file_path = doc.file_path
    count_result = await session.execute(
        select(func.count()).where(Document.file_path == file_path)
    )
    shared_count = count_result.scalar_one()

    await session.execute(sql_delete(Document).where(Document.id == document_id))
    await session.commit()

    # Only remove file from disk if this was the last reference
    if shared_count <= 1 and file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            logger.warning("Could not delete file from disk", path=file_path)

    return True


async def get_document_for_conversation(
    session: AsyncSession, conversation_id: str
) -> Document | None:
    """Get the first document for a conversation, if one exists."""
    stmt = select(Document).where(Document.conversation_id == conversation_id)
    result = await session.execute(stmt)
    return result.scalars().first()


async def get_documents_for_conversation(
    session: AsyncSession, conversation_id: str
) -> list[Document]:
    """Get all documents for a conversation, ordered by upload time."""
    stmt = (
        select(Document)
        .where(Document.conversation_id == conversation_id)
        .order_by(Document.uploaded_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_all_documents(session: AsyncSession) -> list[Document]:
    """Get all documents across all conversations, ordered by upload time descending."""
    stmt = select(Document).order_by(Document.uploaded_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def attach_document(
    session: AsyncSession, conversation_id: str, source_document_id: str
) -> Document | None:
    """Attach an existing document to a conversation without re-uploading.

    Creates a new Document record pointing to the same file and extracted text
    as the source document. Returns None if the source document doesn't exist.
    """
    source = await get_document(session, source_document_id)
    if source is None:
        return None

    document = Document(
        conversation_id=conversation_id,
        filename=source.filename,
        file_path=source.file_path,
        extracted_text=source.extracted_text,
        page_count=source.page_count,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return document
