export function describeAsset(name = "", mime = "") {
  const ext = String(name).toLowerCase().split(".").pop().split("?")[0];
  const table = {
    png: "image",
    jpg: "image",
    jpeg: "image",
    webp: "image",
    svg: "image",
    bmp: "image",
    avif: "image",
    gif: "gif",
    mp4: "video",
    webm: "video",
    mov: "video",
    mkv: "video",
    ogv: "video",
    mp3: "audio",
    mpeg: "audio",
    wav: "audio",
    ogg: "audio",
    m4a: "audio",
    aac: "audio",
    flac: "audio",
    pdf: "application",
    glb: "glb",
    gltf: "gltf",
    fbx: "fbx",
    usdz: "usdz",
    obj: "obj"
  };
  if (table[ext]) return { kind: table[ext], ext };
  if (String(mime).startsWith("image/gif")) return { kind: "gif", ext };
  if (String(mime).startsWith("image/")) return { kind: "image", ext };
  if (String(mime).startsWith("video/")) return { kind: "video", ext };
  if (String(mime).startsWith("audio/")) return { kind: "audio", ext };
  if (String(mime).includes("pdf")) return { kind: "application", ext: "pdf" };
  return { kind: "file", ext: ext || "bin" };
}
