import path from "node:path";
import mammoth from "mammoth";
import * as pdfParseModule from "pdf-parse";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md"]);

function resolveSourceType(originalName, mimeType) {
  const ext = path.extname(originalName || "").toLowerCase();

  if (ext === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }
  if (
    ext === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (ext === ".md" || mimeType === "text/markdown") {
    return "markdown";
  }
  if (ext === ".txt" || mimeType === "text/plain") {
    return "text";
  }

  return null;
}

async function extractPdfText(buffer) {
  // Supports both pdf-parse v2 (PDFParse class) and v1 (default function)
  if (typeof pdfParseModule.PDFParse === "function") {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result?.text || "";
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  const legacyPdfParse = pdfParseModule.default || pdfParseModule;
  if (typeof legacyPdfParse === "function") {
    const result = await legacyPdfParse(buffer);
    return result?.text || "";
  }

  throw new Error("PDF_PARSER_UNAVAILABLE");
}

/**
 * Extracts clean text and normalized sourceType from an uploaded file buffer.
 */
export async function parseUploadedDocument(file) {
  if (!file || !file.buffer) {
    throw new Error("FILE_REQUIRED");
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  const sourceType = resolveSourceType(file.originalname, file.mimetype);
  if (!sourceType) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  let rawText = "";

  if (sourceType === "pdf") {
    rawText = await extractPdfText(file.buffer);
  } else if (sourceType === "docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    rawText = result?.value || "";
  } else {
    rawText = file.buffer.toString("utf8");
  }

  // Strip null bytes that PostgreSQL TEXT columns reject and normalize whitespace
  const cleanedText = rawText.replace(/\u0000/g, "").trim();

  if (!cleanedText) {
    throw new Error("EMPTY_DOCUMENT_CONTENT");
  }

  return {
    sourceType,
    content: cleanedText,
    fileName: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
    fileSizeBytes: file.size ?? file.buffer.length,
  };
}