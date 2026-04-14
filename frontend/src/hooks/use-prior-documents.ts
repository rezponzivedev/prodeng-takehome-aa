import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api";
import type { Document } from "../types";

const MAX_PRIOR_DOCS = 8;

/**
 * Fetches all documents across all conversations and returns a deduplicated
 * list (capped at 8 most recent) of previously uploaded documents, excluding
 * those already attached to the given conversation.
 *
 * Re-fetches whenever the active conversation changes so the list is always
 * current when the user switches contexts.
 */
export function usePriorDocuments(
	conversationId: string | null,
	currentDocuments: Document[],
) {
	const [allDocuments, setAllDocuments] = useState<Document[]>([]);
	const [attaching, setAttaching] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const docs = await api.fetchAllDocuments();
			setAllDocuments(docs);
		} catch {
			// Non-critical — silently swallow, prior docs are a convenience feature
		}
	}, []);

	// Re-fetch when the active conversation changes so newly uploaded files
	// from other conversations become visible immediately.
	useEffect(() => {
		refresh();
	}, [refresh, conversationId]);

	// Deduplicate by filename (keep most-recent occurrence since allDocuments is
	// sorted uploaded_at DESC), exclude filenames already in this conversation,
	// and cap at MAX_PRIOR_DOCS.
	const currentFilenames = new Set(currentDocuments.map((d) => d.filename));
	const seen = new Set<string>();
	const previousDocuments: Document[] = [];
	for (const doc of allDocuments) {
		if (previousDocuments.length >= MAX_PRIOR_DOCS) break;
		if (
			!currentFilenames.has(doc.filename) &&
			!seen.has(doc.filename) &&
			doc.conversation_id !== conversationId
		) {
			seen.add(doc.filename);
			previousDocuments.push(doc);
		}
	}

	const attach = useCallback(
		async (documentId: string): Promise<Document | null> => {
			if (!conversationId) return null;
			try {
				setAttaching(true);
				return await api.attachDocument(conversationId, documentId);
			} catch {
				return null;
			} finally {
				setAttaching(false);
			}
		},
		[conversationId],
	);

	return { previousDocuments, attach, attaching, refresh };
}
