import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api";
import type { Document } from "../types";

export function useDocument(conversationId: string | null) {
	const [documents, setDocuments] = useState<Document[]>([]);
	const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const activeDocument =
		documents.find((d: Document) => d.id === activeDocumentId) ?? documents[0] ?? null;

	const refresh = useCallback(async () => {
		if (!conversationId) {
			setDocuments([]);
			setActiveDocumentId(null);
			return;
		}
		try {
			setError(null);
			const detail = await api.fetchConversation(conversationId);
			setDocuments(detail.documents);
			setActiveDocumentId((prev: string | null) => {
				if (prev && detail.documents.find((d: Document) => d.id === prev)) return prev;
				return detail.documents[0]?.id ?? null;
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load documents");
		}
	}, [conversationId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const upload = useCallback(
		async (files: File | File[]) => {
			if (!conversationId) return null;
			const fileArray = Array.isArray(files) ? files : [files];
			try {
				setUploading(true);
				setError(null);
				let lastDoc: Document | null = null;
				for (const file of fileArray) {
					const doc = await api.uploadDocument(conversationId, file);
					setDocuments((prev: Document[]) => [...prev, doc]);
					lastDoc = doc;
				}
				if (lastDoc) {
					setActiveDocumentId(lastDoc.id);
				}
				return lastDoc;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to upload document",
				);
				return null;
			} finally {
				setUploading(false);
			}
		},
		[conversationId],
	);

	const remove = useCallback(
		async (documentId: string) => {
			try {
				await api.deleteDocument(documentId);
				setDocuments((prev: Document[]) => {
					const remaining = prev.filter((d: Document) => d.id !== documentId);
					setActiveDocumentId((current: string | null) => {
						if (current !== documentId) return current;
						return remaining[0]?.id ?? null;
					});
					return remaining;
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to delete document");
			}
		},
		[],
	);

	return {
		documents,
		activeDocument,
		activeDocumentId,
		setActiveDocumentId,
		uploading,
		error,
		upload,
		remove,
		refresh,
	};
}
