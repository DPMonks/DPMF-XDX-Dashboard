import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const root = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = path.resolve(root, "..", "data", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "file")
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80);
    cb(null, `${Date.now()}-${safe}`);
  }
});

export const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 } });

export function storedUploadPath(file) {
  return file ? `uploads/${file.filename}` : "";
}

export function diskPathForStored(stored) {
  if (!stored) return null;
  const name = String(stored).replace(/^\/?api\/uploads\//, "").replace(/^uploads\//, "");
  const full = path.join(uploadDir, name);
  return full.startsWith(uploadDir) ? full : null;
}
