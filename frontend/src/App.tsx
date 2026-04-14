import { useCallback, useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DocumentViewer } from "./components/DocumentViewer";
import { TooltipProvider } from "./components/ui/tooltip";
import { useConversations } from "./hooks/use-conversations";
import { useDocument } from "./hooks/use-document";
import { useMessages } from "./hooks/use-messages";
import { usePriorDocuments } from "./hooks/use-prior-documents";
import type { Document } from "./types";

export default function App() {
	const {
		conversations,
		selectedId,
		loading: conversationsLoading,
		create,
		select,
		remove,
		refresh: refreshConversations,
	} = useConversations();

	const {
		messages,
		loading: messagesLoading,
		error: messagesError,
		streaming,
		streamingContent,
		send,
	} = useMessages(selectedId);

	const {
		documents,
		activeDocument,
		activeDocumentId,
		setActiveDocumentId,
		upload,
		remove: removeDocument,
		uploading,
		refresh: refreshDocument,
	} = useDocument(selectedId);

	const hasDocument = documents.length > 0;

	const {
		previousDocuments,
		attach,
		attaching,
		refresh: refreshPriorDocuments,
	} = usePriorDocuments(selectedId, documents);

	const [currentPage, setCurrentPage] = useState(1);

	const handleAttach = useCallback(
		async (documentId: string) => {
			const doc = await attach(documentId);
			if (doc) {
				refreshDocument();
				refreshPriorDocuments();
			}
		},
		[attach, refreshDocument, refreshPriorDocuments],
	);

	const handleSelectDocument = useCallback(
		(documentId: string) => {
			setActiveDocumentId(documentId);
			setCurrentPage(1);
		},
		[setActiveDocumentId],
	);

	const handleJumpToPage = useCallback(
		(documentId: string, page: number) => {
			setActiveDocumentId(documentId);
			setCurrentPage(page);
		},
		[setActiveDocumentId],
	);

	const handleSend = useCallback(
		async (content: string) => {
			await send(content);
			refreshConversations();
		},
		[send, refreshConversations],
	);

	const handleUpload = useCallback(
		async (files: File | File[]) => {
			const doc = await upload(files);
			if (doc) {
				refreshDocument();
				refreshConversations();
				refreshPriorDocuments();
			}
		},
		[upload, refreshDocument, refreshConversations, refreshPriorDocuments],
	);

	const handleCreate = useCallback(async () => {
		await create();
	}, [create]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex h-screen bg-neutral-50">
				<ChatSidebar
					conversations={conversations}
					selectedId={selectedId}
					loading={conversationsLoading}
					onSelect={select}
					onCreate={handleCreate}
					onDelete={remove}
				/>

				<ChatWindow
					messages={messages}
					loading={messagesLoading}
					error={messagesError}
					streaming={streaming}
					streamingContent={streamingContent}
					hasDocument={hasDocument}
					conversationId={selectedId}
					documents={documents}
					previousDocuments={previousDocuments}
					onSend={handleSend}
					onUpload={(files: File[]) => handleUpload(files)}
					onJumpToPage={handleJumpToPage}
					onAttach={handleAttach}
					attaching={attaching}
				/>

				<DocumentViewer
					documents={documents}
					activeDocumentId={activeDocumentId}
					currentPage={currentPage}
					onSelectDocument={handleSelectDocument}
					onPageChange={setCurrentPage}
					onUpload={(files: File[]) => handleUpload(files)}
					onRemoveDocument={removeDocument}
					uploading={uploading}
					previousDocuments={previousDocuments}
					onAttach={handleAttach}
					attaching={attaching}
				/>
			</div>
		</TooltipProvider>
	);
}
