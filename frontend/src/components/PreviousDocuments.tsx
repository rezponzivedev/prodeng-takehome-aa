import { FileText, Plus } from "lucide-react";
import type { Document } from "../types";

interface PreviousDocumentsProps {
	documents: Document[];
	onAttach: (documentId: string) => void;
	attaching?: boolean;
}

export function PreviousDocuments({
	documents,
	onAttach,
	attaching = false,
}: PreviousDocumentsProps) {
	if (documents.length === 0) return null;

	// Fix height to show ~3 rows when the list is longer, so it scrolls rather
	// than dominating the layout. Each row is ~40px; 3 rows ≈ 120px.
	const scrollable = documents.length > 3;

	return (
		<div className="w-full max-w-md">
			<p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
				Your documents
			</p>
			<ul
				className={`divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white ${
					scrollable ? "max-h-[120px] overflow-y-auto" : ""
				}`}
			>
				{documents.map((doc) => (
					<li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
						<FileText className="h-4 w-4 flex-shrink-0 text-neutral-400" />
						<span
							className="min-w-0 flex-1 truncate text-sm text-neutral-700"
							title={doc.filename}
						>
							{doc.filename}
						</span>
						<button
							type="button"
							disabled={attaching}
							onClick={() => onAttach(doc.id)}
							className="flex flex-shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
						>
							<Plus className="h-3 w-3" />
							Add
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
