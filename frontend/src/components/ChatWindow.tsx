import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Document, Message } from "../types";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageBubble, StreamingBubble } from "./MessageBubble";

interface ChatWindowProps {
	messages: Message[];
	loading: boolean;
	error: string | null;
	streaming: boolean;
	streamingContent: string;
	hasDocument: boolean;
	conversationId: string | null;
	documents?: Document[];
	previousDocuments?: Document[];
	onSend: (content: string) => void;
	onUpload: (files: File[]) => void;
	onJumpToPage?: (documentId: string, page: number) => void;
	onAttach?: (documentId: string) => void;
	attaching?: boolean;
}

export function ChatWindow({
	messages,
	loading,
	error,
	streaming,
	streamingContent,
	hasDocument,
	conversationId,
	documents,
	previousDocuments,
	onSend,
	onUpload,
	onJumpToPage,
	onAttach,
	attaching,
}: ChatWindowProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [showScrollButton, setShowScrollButton] = useState(false);
	const isAtBottomRef = useRef(true);
	const messagesLength = messages.length;

	const scrollToBottom = () => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	};

	// Track whether the user is near the bottom so streaming auto-scroll
	// doesn't hijack them if they've scrolled up to read history.
	// Re-run when conversationId or messagesLength changes so the listener is
	// attached after the scrollable div mounts (early-return branches don't
	// render it, so scrollRef.current is null until we reach the main layout).
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => {
			const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
			isAtBottomRef.current = distanceFromBottom < 80;
			setShowScrollButton(distanceFromBottom > 150);
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [conversationId, messagesLength]);

	// New message added — always scroll. Deferred one frame so the DOM has
	// painted the new bubble before we read scrollHeight.
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [messagesLength]);

	// Streaming chunks — only scroll if already at the bottom, so reading
	// history isn't interrupted while a response is being generated.
	// biome-ignore lint/correctness/useExhaustiveDependencies: streamingContent is the intentional trigger
	useEffect(() => {
		if (isAtBottomRef.current) {
			scrollToBottom();
		}
	}, [streamingContent]);

	// No conversation selected
	if (!conversationId) {
		return (
			<div className="flex flex-1 items-center justify-center bg-neutral-50">
				<div className="text-center">
					<p className="text-sm text-neutral-400">
						Select a conversation or create a new one
					</p>
				</div>
			</div>
		);
	}

	// Loading messages
	if (loading) {
		return (
			<div className="flex flex-1 items-center justify-center bg-white">
				<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
			</div>
		);
	}

	// Empty conversation - show upload prompt
	if (messages.length === 0 && !streaming) {
		return (
			<div className="flex flex-1 flex-col bg-white">
				<div className="flex flex-1 items-center justify-center overflow-y-auto py-8">
					<EmptyState
						onUpload={onUpload}
						hasDocument={hasDocument}
						previousDocuments={previousDocuments}
						onAttach={onAttach}
						attaching={attaching}
					/>
				</div>
				<ChatInput
					onSend={onSend}
					onUpload={onUpload}
					disabled={streaming}
					hasDocument={hasDocument}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col bg-white">
			{error && (
				<div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
					{error}
				</div>
			)}

			<div className="relative flex-1 overflow-hidden">
				<div ref={scrollRef} className="h-full overflow-y-auto px-6 py-4">
					<div className="mx-auto max-w-2xl space-y-1">
						{messages.map((message) => (
							<MessageBubble
								key={message.id}
								message={message}
								documents={documents}
								onJumpToPage={onJumpToPage}
							/>
						))}
						{streaming && <StreamingBubble content={streamingContent} />}
					</div>
				</div>
				{showScrollButton && (
					<button
						type="button"
						onClick={scrollToBottom}
						className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
					>
						<ChevronDown className="h-3.5 w-3.5" />
						Scroll to bottom
					</button>
				)}
			</div>

			<ChatInput
				onSend={onSend}
				onUpload={onUpload}
				disabled={streaming}
				hasDocument={hasDocument}
			/>
		</div>
	);
}
