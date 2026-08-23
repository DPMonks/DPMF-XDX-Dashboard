export const INDEXER_ORIGIN =
  process.env.INDEXER_ORIGIN ||
  "https://dpmf-xdx-indexer-production.up.railway.app";

export const XRPL_RPC = process.env.XRPL_RPC || "https://xrplcluster.com";

export const XIO_ISSUER = "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU";
export const XIO_CURRENCY = "XIO";
export const XDX_ISSUER = "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";
export const XDX_CURRENCY = "XDX";
export const XSQUAD_ISSUER = "roBYiFtZsTRpWEUw6TtpUCwZCfjcQeRBg";
export const XSQUAD_CURRENCY = "XSQUAD";

export const THREE_D_TYPES = ["glb", "gltf", "fbx", "usdz"];
export const MODEL_MIMES = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/vnd.autodesk.fbx",
  usdz: "model/vnd.usdz+zip"
};

export const DEMO_GLB =
  "https://modelviewer.dev/shared-assets/models/Astronaut.glb";
