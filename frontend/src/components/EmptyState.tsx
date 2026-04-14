import { FileSearch, FilePlus } from "lucide-react";
import type { Document } from "../types";
import { DocumentUpload } from "./DocumentUpload";
import { PreviousDocuments } from "./PreviousDocuments";

interface EmptyStateProps {
	onUpload: (files: File[]) => void;
	uploading?: boolean;
	hasDocument?: boolean;
	previousDocuments?: Document[];
	onAttach?: (documentId: string) => void;
	attaching?: boolean;
}

export function EmptyState({
	onUpload,
	uploading,
	hasDocument = false,
	previousDocuments = [],
	onAttach,
	attaching,
}: EmptyStateProps) {
	const hasPrevious = previousDocuments.length > 0 && !!onAttach;

	if (hasDocument) {
		// Compact mode: documents already loaded, offer to add more or start chatting
		return (
			<div className="flex flex-col items-center px-4">
				<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
					<FilePlus className="h-5 w-5 text-neutral-500" />
				</div>
				<p className="mb-1 text-sm font-medium text-neutral-700">
					Add more documents
				</p>
				<p className="mb-6 text-xs text-neutral-400">
					Or ask a question below to get started
				</p>
				{hasPrevious && (
					<div className="mb-4 w-full max-w-md">
						<PreviousDocuments
							documents={previousDocuments}
							onAttach={onAttach}
							attaching={attaching}
						/>
					</div>
				)}
				<DocumentUpload onUpload={onUpload} uploading={uploading} />
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center px-4">
			<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900">
				<FileSearch className="h-7 w-7 text-white" />
			</div>
			<h2 className="mb-2 text-lg font-semibold text-neutral-800">
				Upload a document to get started
			</h2>
			<p className="mb-8 max-w-sm text-center text-sm text-neutral-500">
				Ask questions about leases, title reports, contracts, and other legal
				documents
			</p>
			{hasPrevious && (
				<div className="mb-6 w-full max-w-md">
					<PreviousDocuments
						documents={previousDocuments}
						onAttach={onAttach}
						attaching={attaching}
					/>
				</div>
			)}
			<DocumentUpload onUpload={onUpload} uploading={uploading} />
		</div>
	);
}
