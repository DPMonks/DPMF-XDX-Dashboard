/** Every mintable type on Create NFT — mime, extension, and viewer kind. */

export const FILE_KINDS = {
  image: ["png", "jpg", "jpeg", "webp", "svg", "bmp", "avif", "tif", "tiff", "apng"],
  gif: ["gif"],
  video: ["mp4", "webm", "ogv", "ogg", "mov", "mkv", "avi", "m4v", "quicktime"],
  audio: ["mp3", "mpeg", "ogg", "oga", "wav", "m4a", "aac", "flac", "weba", "wma"],
  application: ["pdf"],
  glb: ["glb"],
  gltf: ["gltf"],
  fbx: ["fbx"],
  usdz: ["usdz"],
  obj: ["obj"]
};

export const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
  apng: "image/apng",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  m4v: "video/mp4",
  quicktime: "video/quicktime",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  wma: "audio/x-ms-wma",
  pdf: "application/pdf",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/vnd.autodesk.fbx",
  usdz: "model/vnd.usdz+zip",
  obj: "model/obj"
};

export const MIME_TO_KIND = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/svg+xml": "image",
  "image/bmp": "image",
  "image/avif": "image",
  "image/tiff": "image",
  "image/apng": "image",
  "image/gif": "gif",
  "video/mp4": "video",
  "video/webm": "video",
  "video/ogg": "video",
  "video/quicktime": "video",
  "video/x-matroska": "video",
  "video/x-msvideo": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/mp4": "audio",
  "audio/aac": "audio",
  "audio/flac": "audio",
  "audio/webm": "audio",
  "audio/x-ms-wma": "audio",
  "application/pdf": "application",
  "application/octet-stream": null,
  "application/vnd.autodesk.fbx": "fbx",
  "model/gltf-binary": "glb",
  "model/gltf+json": "gltf",
  "model/vnd.usdz+zip": "usdz",
  "model/obj": "obj",
  "text/plain": null
};

export const ACCEPTED_MIMES = [
  ...Object.keys(MIME_TO_KIND),
  "application/octet-stream"
];

export const FILE_ACCEPT = [
  ...Object.keys(MIME_TO_KIND),
  ...Object.keys(MIME_BY_EXT).map((ext) => `.${ext}`)
].join(",");

export const FILE_LABEL =
  "png, jpg, jpeg, gif, webp, svg, bmp, avif, mp4, webm, mov, mkv, ogg, mp3, wav, m4a, aac, flac, pdf, glb, gltf, fbx, usdz, obj";

export function extensionOf(nameOrType = "") {
  const value = String(nameOrType).toLowerCase().split("?")[0];
  if (value.includes(".")) return value.split(".").pop();
  return value.replace(/^\./, "");
}

export function kindFromExt(ext) {
  const clean = extensionOf(ext);
  return Object.keys(FILE_KINDS).find((kind) => FILE_KINDS[kind].includes(clean)) || null;
}

export function mimeFromFile(file) {
  if (file?.type && file.type.trim() && file.type !== "application/octet-stream") {
    return file.type;
  }
  const ext = extensionOf(file?.name || "");
  return MIME_BY_EXT[ext] || file?.type || "application/octet-stream";
}

export function describeFile(fileOrName, mimeHint) {
  const name = typeof fileOrName === "string" ? fileOrName : fileOrName?.name || "";
  const mime = mimeHint || mimeFromFile(typeof fileOrName === "object" ? fileOrName : { name, type: "" });
  const ext = extensionOf(name) || extensionOf(mime);
  const kind = MIME_TO_KIND[mime] || kindFromExt(ext) || kindFromExt(mime) || "file";
  return {
    mime,
    extension: ext,
    kind,
    ftype: ext || kind,
    ctype: kind,
    fileType: kind,
    contentType: kind
  };
}

export function isAllowedFile(file) {
  const { kind, extension } = describeFile(file);
  if (kind && kind !== "file") return true;
  return Boolean(kindFromExt(extension));
}

export function normalizeViewerType(fileType) {
  const raw = String(fileType || "").toLowerCase();
  if (["image", "gif", "video", "audio", "application", "pdf", "glb", "gltf", "fbx", "usdz", "obj", "file"].includes(raw)) {
    return raw === "pdf" ? "application" : raw;
  }
  if (raw.startsWith("image/gif") || raw === "gif") return "gif";
  if (raw.startsWith("image/")) return "image";
  if (raw.startsWith("video/")) return "video";
  if (raw.startsWith("audio/")) return "audio";
  if (raw.includes("pdf")) return "application";
  return kindFromExt(raw) || MIME_TO_KIND[raw] || "file";
}
