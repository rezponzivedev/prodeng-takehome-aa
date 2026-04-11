import { ChevronLeft, ChevronRight, FileText, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getDocumentUrl } from "../lib/api";
import type { Document } from "../types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

const MIN_WIDTH = 280;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 400;

interface DocumentViewerProps {
	documents: Document[];
	activeDocumentId: string | null;
	currentPage: number;
	onSelectDocument: (id: string) => void;
	onPageChange: (page: number) => void;
	onUpload: (files: File[]) => void;
	onRemoveDocument: (id: string) => void;
	uploading?: boolean;
}

export function DocumentViewer({
	documents,
	activeDocumentId,
	currentPage,
	onSelectDocument,
	onPageChange,
	onUpload,
	onRemoveDocument,
	uploading = false,
}: DocumentViewerProps) {
	const [numPages, setNumPages] = useState<number>(0);
	const [pdfLoading, setPdfLoading] = useState(true);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const [dragging, setDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const activeDocument =
		documents.find((d: Document) => d.id === activeDocumentId) ??
		documents[0] ??
		null;

	// Reset page when switching documents
	useEffect(() => {
		onPageChange(1);
		setPdfLoading(true);
		setPdfError(null);
	}, [activeDocument?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setDragging(true);

			const startX = e.clientX;
			const startWidth = width;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = startX - moveEvent.clientX;
				const newWidth = Math.min(
					MAX_WIDTH,
					Math.max(MIN_WIDTH, startWidth + delta),
				);
				setWidth(newWidth);
			};

			const handleMouseUp = () => {
				setDragging(false);
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
		},
		[width],
	);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);
			if (files.length > 0) {
				onUpload(files);
			}
			// Reset so the same file can be re-selected if needed
			e.target.value = "";
		},
		[onUpload],
	);

	const pdfPageWidth = width - 48;
	const pdfUrl = activeDocument ? getDocumentUrl(activeDocument.id) : null;

	if (documents.length === 0) {
		return (
			<div
				style={{ width }}
				className="flex h-full flex-shrink-0 flex-col items-center justify-center border-l border-neutral-200 bg-neutral-50"
			>
				<FileText className="mb-3 h-10 w-10 text-neutral-300" />
				<p className="text-sm text-neutral-400">No document uploaded</p>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			style={{ width }}
			className="relative flex h-full flex-shrink-0 flex-col border-l border-neutral-200 bg-white"
		>
			{/* Resize handle */}
			<div
				className={cn(
					"absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-neutral-300",
					dragging && "bg-neutral-400",
				)}
				onMouseDown={handleMouseDown}
			/>

			{/* Tab strip */}
			<div className="flex items-end gap-0.5 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-1 pt-1">
				{documents.map((doc: Document) => (
					<div
						key={doc.id}
						className={cn(
							"group flex items-center gap-1 rounded-t border px-2.5 py-1.5 text-xs transition-colors",
							doc.id === activeDocumentId
								? "-mb-px border-neutral-200 border-b-white bg-white font-medium text-neutral-900"
								: "border-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700",
						)}
					>
						<button
							type="button"
							onClick={() => onSelectDocument(doc.id)}
							title={doc.filename}
							className="flex min-w-0 items-center gap-1"
						>
							<FileText className="h-3 w-3 flex-shrink-0" />
							<span className="max-w-[110px] truncate">{doc.filename}</span>
						</button>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onRemoveDocument(doc.id);
							}}
							className="ml-0.5 flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-200 hover:text-neutral-700"
							title={`Remove ${doc.filename}`}
						>
							<X className="h-2.5 w-2.5" />
						</button>
					</div>
				))}

				{/* Add document button */}
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
							className="mb-0.5 ml-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50"
						>
							{uploading ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Plus className="h-3.5 w-3.5" />
							)}
						</button>
					</TooltipTrigger>
					<TooltipContent>Add document</TooltipContent>
				</Tooltip>

				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf"
					multiple
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>

			{/* PDF content */}
			<div className="flex-1 overflow-y-auto p-4">
				{pdfError && (
					<div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
						{pdfError}
					</div>
				)}

				{pdfUrl && (
					<PDFDocument
						file={pdfUrl}
						onLoadSuccess={({ numPages: pages }) => {
							setNumPages(pages);
							setPdfLoading(false);
							setPdfError(null);
						}}
						onLoadError={(error) => {
							setPdfError(`Failed to load PDF: ${error.message}`);
							setPdfLoading(false);
						}}
						loading={
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
							</div>
						}
					>
						{!pdfLoading && !pdfError && (
							<Page
								pageNumber={currentPage}
								width={pdfPageWidth}
								loading={
									<div className="flex items-center justify-center py-12">
										<Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
									</div>
								}
							/>
						)}
					</PDFDocument>
				)}
			</div>

			{/* Page navigation */}
			{numPages > 0 && (
				<div className="flex items-center justify-center gap-3 border-t border-neutral-100 px-4 py-2.5">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						disabled={currentPage <= 1}
						onClick={() => onPageChange(Math.max(1, currentPage - 1))}
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<span className="text-xs text-neutral-500">
						Page {currentPage} of {numPages}
					</span>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						disabled={currentPage >= numPages}
						onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			)}
		</div>
	);
}
