import React, {
  useEffect,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef
} from "react";
// import "@google/model-viewer";
import { detectModelMimeType } from "../../helper";
import { useDispatch } from "react-redux";
import config from "../../config.json";
import { createFBXFileAction } from "../../store/actions/profile";
import { cleanupStagedUploads } from "../../store/services/profile";
import { isIOS } from "react-device-detect";

const ModelViewer = forwardRef(
  (
    {
      fbxPath,
      width = "100%",
      height = 200,
      setFBXtoGBL,
      usdzPath,
      setIsActive = () => {},
      onReady = () => {},
      onErrorFallback,
      onRegisterStagedPath,
      modelSlotIndex
    },
    ref
  ) => {
    const viewerRef = useRef(null);
    const curref = useRef(null);

    const dispatch = useDispatch();

    const [glbPath, setGLBPath] = useState("");
    const [progress, setProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [phase, setPhase] = useState("init");
    const readyNotifiedRef = useRef(false);

    const notifyReady = () => {
      if (readyNotifiedRef.current) return;
      readyNotifiedRef.current = true;
      onReady();
    };

    // === Helper: Update path only when actually different ===
    const updateGLBPath = (newPath) => {
      setGLBPath((prev) => (prev === newPath ? prev : newPath));
    };

    useImperativeHandle(ref, () => ({
      activateAR: () => {
        viewerRef.current?.activateAR();
      }
    }));

    useEffect(() => {
      import("@google/model-viewer");
    }, []);

    // --- Convert FBX or assign GLB path ---
    useEffect(() => {
      if (!fbxPath) return;
      let cancelled = false;
      readyNotifiedRef.current = false;
      setPhase("converting");
      setError(false);
      setIsLoading(true);
      setProgress(0);

      (async () => {
        try {
          const type = await detectModelMimeType(fbxPath);
          // if fbx file has already been deployed on ipfs
          if (type === "fbx" && fbxPath.includes("/ipfs")) {
            if (curref.current) return;
            curref.current = true;

            const res = await fetch(
              `${config.LOCAL_API_URL}convert-fbx?url=${encodeURIComponent(
                fbxPath
              )}`
            );
            if (!res.ok) throw new Error("Backend conversion failed");
            const blob = await res.blob();
            if (cancelled) return;
            updateGLBPath(URL.createObjectURL(blob));
            curref.current = false;
            // } else if (fbxPath.startsWith("data:")) {
          } else if (fbxPath instanceof File) {
            const name = (fbxPath.name || "").toLowerCase();
            const isFbx = type === "fbx" || name.endsWith(".fbx");
            const isGlbFamily =
              type === "glb" ||
              type === "gltf" ||
              name.endsWith(".glb") ||
              name.endsWith(".gltf");

            if (isFbx) {
              const formData = new FormData();
              formData.append("fbxImage", fbxPath);

              const res = await dispatch(
                createFBXFileAction({ data: formData })
              );
              if (cancelled) {
                if (res?.fbxFile) await cleanupStagedUploads([res.fbxFile]);
                return;
              }
              if (res?.fbxFile && typeof onRegisterStagedPath === "function") {
                onRegisterStagedPath(res.fbxFile);
              }
              const glbUrl = config.LOCAL_API_URL + res.fbxFile;
              updateGLBPath(glbUrl);

              const glbResponse = await fetch(glbUrl);
              const glbBlob = await glbResponse.blob();
              const file = new File([glbBlob], "model.glb", {
                type: "model/gltf-binary"
              });
              setFBXtoGBL((prev) => {
                if (typeof modelSlotIndex !== "number") {
                  return [...prev, file];
                }
                const next = [...prev];
                while (next.length <= modelSlotIndex) next.push(undefined);
                next[modelSlotIndex] = file;
                return next;
              });
            } else if (isGlbFamily) {
              const localPreviewUrl = URL.createObjectURL(fbxPath);
              if (cancelled) {
                URL.revokeObjectURL(localPreviewUrl);
                return;
              }
              updateGLBPath(localPreviewUrl);
            } else {
              throw new Error("Unsupported model file type");
            }
          } else {
            // Already GLB/GLTF/URL
            try {
              const response = await fetch(fbxPath, { method: "HEAD" });
              if (!response.ok) throw new Error("Failed to fetch headers");

              const contentLength = response.headers.get("content-length");
              const sizeInBytes = contentLength
                ? parseInt(contentLength, 10)
                : 0;

              const MAX_SIZE = 30 * 1024 * 1024; // 30 MB
              const isIPFS = fbxPath.includes("/ipfs/");

              if (isIPFS && sizeInBytes > MAX_SIZE) {
                const ipfsHash = fbxPath.split("/ipfs/")[1];
                const newUrl = `${config.LOCAL_API_URL}proxy-ipfs?hash=${ipfsHash}`;
                if (!cancelled) updateGLBPath(newUrl);
              } else {
                if (!cancelled) updateGLBPath(fbxPath);
              }
            } catch (err) {
              console.warn("⚠️ Fallback to direct URL:", err);
              if (!cancelled) updateGLBPath(fbxPath);
            }
          }

          if (cancelled) return;
          // Only mark rendering after src assigned
          setPhase("rendering");
        } catch (err) {
          console.error("❌ Failed preparing model:", err);
          setError(true);
          setIsLoading(false);
          setPhase("error");
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [fbxPath]);

    // --- Event listeners (only attach once) ---
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const handleProgress = (e) => {
        const val = Math.min(
          Math.round((e.detail.totalProgress || 0) * 100),
          99
        );
        setProgress(val);
      };

      const handleLoad = () => {
        setIsLoading(false);
        setProgress(100);
        setPhase("done");
        setIsActive(true);
        notifyReady();
      };

      // const handleError = (e) => {
      //   console.error("❌ Model failed:", e.detail);
      //   setError(true);
      //   setIsLoading(false);
      //   setPhase("error");
      // };
      const handleError = (e) => {
        console.error(" Model failed:", e.detail);

        // 🔑 Retry once via proxy
        if (onErrorFallback && fbxPath && !fbxPath.includes("/assets?url=")) {
          onErrorFallback();
          return; // stop here, retry instead
        }

        // final failure
        setError(true);
        setIsLoading(false);
        setPhase("error");
        notifyReady();
      };

      viewer.addEventListener("progress", handleProgress);
      viewer.addEventListener("load", handleLoad);
      viewer.addEventListener("error", handleError);

      return () => {
        viewer.removeEventListener("progress", handleProgress);
        viewer.removeEventListener("load", handleLoad);
        viewer.removeEventListener("error", handleError);
      };
    }, []); // ⬅️ only once on mount

    // --- Cleanup blob URLs ---
    useEffect(() => {
      return () => {
        if (glbPath?.startsWith("blob:")) {
          URL.revokeObjectURL(glbPath);
        }
      };
    }, [glbPath]);

    const containerStyle = {
      width,
      height,
      position: "relative",
      background: "#fff",
      borderRadius: "10px",
      overflow: "hidden"
    };

    const overlayStyle = {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      background: "rgba(255, 255, 255, 0.8)",
      borderRadius: "8px",
      zIndex: 10
    };

    const spinnerStyle = {
      width: "25%",
      height: "25%",
      maxWidth: "30px",
      maxHeight: "30px",
      minWidth: "16px",
      minHeight: "16px",
      border: "0.2em solid #ccc",
      borderTop: "0.2em solid #000",
      borderRadius: "50%",
      animation: "spin 1s linear infinite"
    };

    let overlayContent = null;
    if (phase === "init") {
      overlayContent = (
        <>
          <div style={spinnerStyle} />
          <span style={{ marginTop: "8px" }}>Initializing...</span>
        </>
      );
    } else if (phase === "converting") {
      overlayContent = (
        <>
          <div style={spinnerStyle} />
          <span style={{ marginTop: "8px" }}>Preparing...</span>
        </>
      );
    } else if (phase === "rendering") {
      overlayContent = (
        <>
          <div style={spinnerStyle} />
          <span style={{ marginTop: "8px" }}>{`Loading ${progress}%`}</span>
        </>
      );
    } else if (phase === "error") {
      overlayContent = <span>❌ Model failed to load</span>;
    }

    return (
      <div style={containerStyle}>
        {isLoading && <div style={overlayStyle}>{overlayContent}</div>}
        <model-viewer
          preload
          ref={viewerRef}
          src={glbPath}
          {...(isIOS && !!usdzPath ? { "ios-src": usdzPath } : {})}
          ar
          ar-modes="webxr scene-viewer quick-look"
          auto-rotate
          camera-controls
          environment-image="neutral"
          shadow-intensity="0"
          exposure="1.0"
          style={{ width: "100%", height: "100%" }}
          onArStatus={(e) => {
            if (e.detail === "not-presenting") {
              setIsActive?.(false);
            }
          }}
        />
      </div>
    );
  }
);

export default ModelViewer;
