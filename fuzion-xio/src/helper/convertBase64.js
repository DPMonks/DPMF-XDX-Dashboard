import config from "../config.json";

export const isBase64DataURL = (str) => {
  if (typeof str !== "string") return false;

  // Check for data URL pattern (e.g. data:image/png;base64,...)
  if (str.startsWith("data:") && str.includes(";base64,")) return true;

  //Basic regex for pure Base64 content (no data URL prefix)
  const base64Regex =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  // Reject if string length is not a multiple of 4 (invalid Base64)
  if (str.length % 4 !== 0) return false;

  return base64Regex.test(str);
};

// export const isBase64DataURL = (str) => {
//   return /^data:[\w\/\+]+;base64,/.test(str);
// };

export const convertToFile = async (base64, name = "file") => {
  let mime = "";
  let data = base64;

  // Step 1: Extract MIME if Base64 is a Data URL
  if (base64.startsWith("data:")) {
    mime = base64
      .substring(base64.indexOf(":") + 1, base64.indexOf(";"))
      .toLowerCase();
    data = base64.substring(base64.indexOf(",") + 1);
  }

  // Step 2: Decode Base64 safely (in chunks)
  const byteCharacters = atob(data);
  const byteArrays = [];
  const sliceSize = 1024;
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  const buffer = byteArrays[0]; // check first few bytes

  // Step 3: Handle missing or invalid MIME (Safari, iOS, or unknown)
  const invalidMimes = [
    "",
    "base64",
    "application/octet-stream",
    "glb",
    "gltf",
    "fbx",
    "usdz",
    "bin",
    "tg",
    "data",
    "text/plain"
  ];

  if (invalidMimes.includes(mime)) {
    // convert to hex string for header detection
    const magic = Array.from(buffer.slice(0, 12))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const textHeader = new TextDecoder().decode(buffer.slice(0, 20));

    // Auto detect from magic bytes or JSON header
    if (magic.startsWith("676c5446"))
      mime = "model/gltf-binary"; // glTF binary (.glb)
    else if (magic.startsWith("4b617964")) mime = "model/fbx"; // 'Kayd' (FBX)
    else if (magic.startsWith("504b0304"))
      mime = "model/vnd.usdz+zip"; // ZIP/USDC/USDA/USDZ
    else if (magic.startsWith("89504e47")) mime = "image/png"; // PNG
    else if (magic.startsWith("ffd8ff")) mime = "image/jpeg"; // JPG
    else if (magic.startsWith("47494638")) mime = "image/gif"; // GIF
    else if (magic.startsWith("25504446")) mime = "application/pdf"; // PDF
    else if (textHeader.trim().startsWith("{"))
      mime = "model/gltf+json"; // JSON glTF
    else if (textHeader.trim().startsWith("<svg"))
      mime = "image/svg+xml"; // SVG
    else if (textHeader.toLowerCase().includes("ply"))
      mime = "model/ply"; // PLY format
    else if (textHeader.toLowerCase().includes("obj"))
      mime = "text/plain"; // OBJ format
    else mime = "application/octet-stream"; // fallback
  }

  // Step 4: Map MIME → Extension
  const mimeToExt = {
    "model/gltf-binary": "glb",
    "model/gltf+json": "gltf",
    "model/gltf": "gltf",
    "model/fbx": "fbx",
    "model/vnd.usdz+zip": "usdz",
    "model/ply": "ply",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/json": "json",
    "text/plain": "txt",
    "application/octet-stream": "bin"
  };

  const ext = mimeToExt[mime] || mime.split("/")[1]?.split("+")[0] || "bin";

  // Step 5: Construct clean final name
  const cleanName = name.replace(/\.[^/.]+$/, "");
  const finalName = `${cleanName}.${ext}`;

  // Step 6: Return File object
  return new File(byteArrays, finalName, { type: mime });
};

// convertBase64.js
export function base64ToBlobUrl(base64, mimeType = "model/gltf-binary") {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);

  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  return URL.createObjectURL(blob);
}

export const converBaseFileToBuffer = (file) => {
  // Clean the base64 (remove prefix if present)
  const base64 = file.split(",")[1]; // removes "data:application/octet-stream;base64," part

  // Convert to binary
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let i = 0; i < byteCharacters.length; i += 1024) {
    const slice = byteCharacters.slice(i, i + 1024);
    const byteNumbers = new Array(slice.length);
    for (let j = 0; j < slice.length; j++) {
      byteNumbers[j] = slice.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  // Create the blob
  const fbxBlob = new Blob(byteArrays, { type: "application/octet-stream" });

  // Optional: create a File object if you want to mimic an uploaded file
  const fbxImage = new File([fbxBlob], "model.fbx", {
    type: "application/octet-stream"
  });
  return fbxImage;
};

const urltoFile = async (url, filename, mimeType) => {
  if (url.startsWith("data:")) {
    const arr = url.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[arr.length - 1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const file = new File([u8arr], filename, { type: mime || mimeType });
    return Promise.resolve(file);
  }
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new File([buf], filename, { type: mimeType });
};

export const convertBase64 = async (file, type) => {
  const MAX_PREVIEW_BYTES = 15 * 1024 * 1024;
  const keepAsFileTypes = new Set(["fbx", "glb", "gltf", "usdz", "obj"]);

  if (keepAsFileTypes.has(type)) {
    return file;
  } else {
    if (file.size > MAX_PREVIEW_BYTES) {
      return file;
    }
    let reader = new FileReader();
    reader.readAsDataURL(file);
    return new Promise((resolve) => {
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function (error) {
        console.log("Error: ", error);
      };
    });
  }
};
