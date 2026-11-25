import express from "express";
import multer from "multer";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { parseUploadedDocument } from "../rag/document-parser.js";
import {
  getUserDocument,
  ingestDocument,
  listUserDocuments,
  removeUserDocument,
  searchUserDocuments,
} from "../services/document.service.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});

const ingestDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(10).max(100000),
  sourceType: z.enum(["text", "markdown", "note"]).optional().default("text"),
});

const searchDocumentsSchema = z.object({
  query: z.string().trim().min(2).max(500),
  agentId: z.string().uuid().optional(),
  topK: z.number().int().min(1).max(10).optional().default(4),
  minScore: z.number().min(0).max(1).optional().default(0.35),
});

const documentIdParamSchema = z.object({
  documentId: z.string().uuid(),
});

router.use(authenticateToken);

/**
 * POST /api/documents
 * Ingests raw text/markdown/note into the user's isolated knowledge base.
 */
router.post("/", async (req, res, next) => {
  try {
    const parsed = ingestDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    const document = await ingestDocument({
      userId: req.user.id,
      ...parsed.data,
    });

    return res.status(201).json({
      success: true,
      data: document,
    });
  } catch (err) {
    if (err.message === "EMPTY_DOCUMENT_CONTENT") {
      return res.status(400).json({
        success: false,
        error: "EMPTY_DOCUMENT_CONTENT",
        message: "Document content cannot be empty after normalization.",
      });
    }
    if (err.message === "DOCUMENT_TOO_LARGE") {
      return res.status(413).json({
        success: false,
        error: "DOCUMENT_TOO_LARGE",
        message: "Document exceeds the maximum allowed chunk limit.",
      });
    }
    next(err);
  }
});

/**
 * POST /api/documents/upload
 * Multipart file upload endpoint supporting .pdf, .docx, .txt, and .md files.
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "FILE_REQUIRED",
        message: "Please upload a file under the 'file' form-data field.",
      });
    }

    const extracted = await parseUploadedDocument(req.file);

    const customTitle =
      typeof req.body?.title === "string" && req.body.title.trim().length > 0
        ? req.body.title.trim().slice(0, 200)
        : extracted.fileName.replace(/\.[^/.]+$/, "").slice(0, 200) ||
          extracted.fileName;
console.log("Custom title:", req.user);
    const document = await ingestDocument({
      userId: req.user.id,
      title: customTitle,
      content: extracted.content,
      sourceType: extracted.sourceType,
      fileName: extracted.fileName,
      mimeType: extracted.mimeType,
      fileSizeBytes: extracted.fileSizeBytes,
    });

    return res.status(201).json({
      success: true,
      data: document,
    });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        error: "FILE_TOO_LARGE",
        message: "Uploaded file exceeds the 5 MB limit.",
      });
    }
    if (err.message === "UNSUPPORTED_FILE_TYPE") {
      return res.status(400).json({
        success: false,
        error: "UNSUPPORTED_FILE_TYPE",
        message: "Only .pdf, .docx, .txt, and .md files are supported.",
      });
    }
    if (err.message === "EMPTY_DOCUMENT_CONTENT") {
      return res.status(400).json({
        success: false,
        error: "EMPTY_DOCUMENT_CONTENT",
        message: "No readable text could be extracted from the uploaded file.",
      });
    }
    if (err.message === "DOCUMENT_TOO_LARGE") {
      return res.status(413).json({
        success: false,
        error: "DOCUMENT_TOO_LARGE",
        message: "Extracted document text exceeds the maximum chunk limit.",
      });
    }
    next(err);
  }
});

/**
 * POST /api/documents/search
 * Performs semantic vector retrieval over the user's (or agent's) documents.
 */
router.post("/search", async (req, res, next) => {
  try {
    const parsed = searchDocumentsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    const matches = await searchUserDocuments({
      userId: req.user.id,
      ...parsed.data,
    });

    return res.status(200).json({
      success: true,
      data: {
        query: parsed.data.query,
        agentId: parsed.data.agentId ?? null,
        matchCount: matches.length,
        results: matches,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents
 * Lists all documents owned by the authenticated user.
 */
router.get("/", async (req, res, next) => {
  try {
    const documents = await listUserDocuments(req.user.id);
    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:documentId
 * Retrieves a single document owned by the authenticated user.
 */
router.get("/:documentId", async (req, res, next) => {
  try {
    const params = documentIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DOCUMENT_ID",
      });
    }

    const document = await getUserDocument(
      req.user.id,
      params.data.documentId
    );

    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (err) {
    if (err.message === "DOCUMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "DOCUMENT_NOT_FOUND",
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/documents/:documentId
 * Deletes a user-owned document and all its chunks.
 */
router.delete("/:documentId", async (req, res, next) => {
  try {
    const params = documentIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DOCUMENT_ID",
      });
    }

    await removeUserDocument(req.user.id, params.data.documentId);

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch (err) {
    if (err.message === "DOCUMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "DOCUMENT_NOT_FOUND",
      });
    }
    next(err);
  }
});

export default router;