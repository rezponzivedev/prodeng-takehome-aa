import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { Message } from "../types";

/**
 * Strips [SOURCES: {...}] and [CITATION: {...}] blocks from streamed text so
 * they never appear as raw JSON in the chat bubble during streaming.
 * Uses a partial-match trim so an in-progress block that hasn't closed yet
 * is also hidden (everything from the opening bracket onward is dropped).
 */
function stripAnnotationBlocks(text: string): string {
	// Remove complete blocks first
	let result = text
		.replace(/\[SOURCES:\s*\{.*?\}\]/gs, "")
		.replace(/\[CITATION:\s*\{.*?\}\]/gs, "");
	// If an incomplete block has started (opening bracket present, no closing ]
	// yet), trim from that point so partial JSON never shows.
	const partialMatch = result.search(/\[(SOURCES|CITATION):/);
	if (partialMatch !== -1) {
		result = result.slice(0, partialMatch);
	}
	return result.trimEnd();
}

export function useMessages(conversationId: string | null) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [streaming, setStreaming] = useState(false);
	const [streamingContent, setStreamingContent] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	const refresh = useCallback(async () => {
		if (!conversationId) {
			setMessages([]);
			return;
		}
		try {
			setLoading(true);
			setError(null);
			const data = await api.fetchMessages(conversationId);
			setMessages(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load messages");
		} finally {
			setLoading(false);
		}
	}, [conversationId]);

	useEffect(() => {
		refresh();
		return () => {
			if (abortRef.current) {
				abortRef.current.abort();
			}
		};
	}, [refresh]);

	const send = useCallback(
		async (content: string) => {
			if (!conversationId || streaming) return;

			const userMessage: Message = {
				id: `temp-${Date.now()}`,
				conversation_id: conversationId,
				role: "user",
				content,
				sources_cited: 0,
				created_at: new Date().toISOString(),
			};

			setMessages((prev) => [...prev, userMessage]);
			setStreaming(true);
			setStreamingContent("");
			setError(null);

			try {
				const response = await api.sendMessage(conversationId, content);

				if (!response.body) {
					throw new Error("No response body");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let accumulated = "";
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					// Keep the last potentially incomplete line in the buffer
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed || !trimmed.startsWith("data: ")) continue;

						const data = trimmed.slice(6);
						if (data === "[DONE]") continue;

						try {
							const parsed = JSON.parse(data) as {
								type?: string;
								content?: string;
								delta?: string;
								message?: Message;
							};

							if (parsed.type === "delta" && parsed.delta) {
								accumulated += parsed.delta;
								setStreamingContent(stripAnnotationBlocks(accumulated));
							} else if (parsed.type === "content" && parsed.content) {
								accumulated += parsed.content;
								setStreamingContent(stripAnnotationBlocks(accumulated));
							} else if (parsed.type === "message" && parsed.message) {
								// Final message from server
								setMessages((prev) => [...prev, parsed.message as Message]);
								accumulated = "";
							} else if (parsed.content && !parsed.type) {
								// Fallback: plain content field
								accumulated += parsed.content;
								setStreamingContent(stripAnnotationBlocks(accumulated));
							}
						} catch {
							// Skip invalid JSON lines
						}
					}
				}

				// If we accumulated content but never got a final message,
				// create a synthetic assistant message
				if (accumulated) {
					const assistantMessage: Message = {
						id: `stream-${Date.now()}`,
						conversation_id: conversationId,
						role: "assistant",
						content: accumulated,
						sources_cited: 0,
						created_at: new Date().toISOString(),
					};
					setMessages((prev) => [...prev, assistantMessage]);
				}

				// Refresh to get server-canonical messages
				const freshMessages = await api.fetchMessages(conversationId);
				setMessages(freshMessages);
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(err instanceof Error ? err.message : "Failed to send message");
			} finally {
				setStreaming(false);
				setStreamingContent("");
			}
		},
		[conversationId, streaming],
	);

	return {
		messages,
		loading,
		error,
		streaming,
		streamingContent,
		send,
		refresh,
	};
}
