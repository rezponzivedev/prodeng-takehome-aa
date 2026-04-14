import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type { Citation, Document, Message } from "../types";

interface MessageBubbleProps {
	message: Message;
	documents?: Document[];
	onJumpToPage?: (documentId: string, page: number) => void;
}

function CitationBlock({
	citation,
	documents,
	onJumpToPage,
}: {
	citation: Citation;
	documents?: Document[];
	onJumpToPage?: (documentId: string, page: number) => void;
}) {
	if (!citation.quote) {
		return (
			<p className="mt-2 text-xs text-amber-600">
				⚠ This answer could not be directly verified against the uploaded documents. Please review manually.
			</p>
		);
	}

	const truncatedQuote =
		citation.quote.length > 120
			? `${citation.quote.slice(0, 120)}…`
			: citation.quote;

	const handleView = () => {
		if (!onJumpToPage || citation.page == null) return;
		const doc = documents?.find((d) => d.filename === citation.document);
		if (doc) {
			onJumpToPage(doc.id, citation.page);
		}
	};

	const canJump = citation.page != null && documents?.some((d) => d.filename === citation.document);

	return (
		<div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
			<p
				className="text-sm text-neutral-700 italic leading-relaxed"
				title={citation.quote}
			>
				"{truncatedQuote}"
			</p>
			<div className="mt-2 flex items-center justify-between">
				<span className="text-xs text-neutral-400">
					{citation.document}
					{citation.page != null && ` · Page ${citation.page}`}
				</span>
				{canJump && (
					<button
						type="button"
						onClick={handleView}
						className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
					>
						View →
					</button>
				)}
			</div>
		</div>
	);
}

export function MessageBubble({ message, documents, onJumpToPage }: MessageBubbleProps) {
	if (message.role === "system") {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="flex justify-center py-2"
			>
				<p className="text-xs text-neutral-400">{message.content}</p>
			</motion.div>
		);
	}

	if (message.role === "user") {
		return (
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
				className="flex justify-end py-1.5"
			>
				<div className="max-w-[75%] rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5">
					<p className="whitespace-pre-wrap text-sm text-neutral-800">
						{message.content}
					</p>
				</div>
			</motion.div>
		);
	}

	// Assistant message
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2 }}
			className="flex gap-3 py-1.5"
		>
			<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900">
				<Bot className="h-4 w-4 text-white" />
			</div>
			<div className="min-w-0 max-w-[80%]">
				<div className="prose">
					<Streamdown>{message.content}</Streamdown>
				</div>
				{message.citation != null && (
					<CitationBlock
						citation={message.citation}
						documents={documents}
						onJumpToPage={onJumpToPage}
					/>
				)}
				{message.sources && message.sources.length > 0 && (() => {
					// Suppress the Sources line when the citation block already names
					// every source — it would just repeat the same filename(s).
					const citedDoc = message.citation?.quote != null ? message.citation.document : null;
					const uncited = message.sources.filter((s) => s !== citedDoc);
					if (uncited.length === 0) return null;
					return (
						<p className="mt-1.5 text-[11px] text-neutral-400">
							Sources: {uncited.join(", ")}
						</p>
					);
				})()}
			</div>
		</motion.div>
	);
}

interface StreamingBubbleProps {
	content: string;
}

export function StreamingBubble({ content }: StreamingBubbleProps) {
	return (
		<div className="flex gap-3 py-1.5">
			<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900">
				<Bot className="h-4 w-4 text-white" />
			</div>
			<div className="min-w-0 max-w-[80%]">
				{content ? (
					<div className="prose">
						<Streamdown mode="streaming">{content}</Streamdown>
					</div>
				) : (
					<div className="flex items-center gap-1 py-2">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
						<span
							className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
							style={{ animationDelay: "0.15s" }}
						/>
						<span
							className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
							style={{ animationDelay: "0.3s" }}
						/>
					</div>
				)}
				<span className="inline-block h-4 w-0.5 animate-pulse bg-neutral-400" />
			</div>
		</div>
	);
}
