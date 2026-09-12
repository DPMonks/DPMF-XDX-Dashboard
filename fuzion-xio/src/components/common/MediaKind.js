import React, { useEffect, useState } from "react";
import Card from "react-bootstrap/Card";
import { Document, Page, pdfjs } from "react-pdf";
import FBXViewer from "./FbxViewer";
import configData from "../../config.json";
import { normalizeViewerType } from "../../const/filetypes";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
);

function MediaKind({
  fileType,
  image,
  profileImg,
  layout,
  usdzPath,
  height,
  isCarouselMobile,
  isActiveSlide,
  onModelReady,
  setFBXtoGBL,
  modelSlotIndex,
  onRegisterStagedPath,
  viewerRef,
  setIsActive,
  variant = "card"
}) {
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [src, setSrc] = useState(image);
  const kind = normalizeViewerType(fileType);

  useEffect(() => {
    setSrc(image);
  }, [image]);

  const withProxy = (url) =>
    `${configData.LOCAL_API_URL}assets?url=${encodeURIComponent(url)}`;

  const handleError = () => {
    if (typeof src === "string" && src === image && !String(src).startsWith("blob:")) {
      setSrc(withProxy(image));
    }
  };

  const loader = (
    <div className="three-body">
      <div className="three-body__dot" />
      <div className="three-body__dot" />
      <div className="three-body__dot" />
    </div>
  );

  const profile = !!profileImg && (
    <div className="img-box-home">
      <div className="proFile">
        <img src={profileImg} alt="" className="inner-ing" />
      </div>
    </div>
  );

  if (kind === "image" || kind === "gif") {
    return (
      <div className="main-img">
        <Card.Img
          variant="top"
          src={src}
          onError={handleError}
          className={
            variant === "preview"
              ? "min-height-200-new11 img_max_preview"
              : "min-height-200-new imgRadius mb-md-3"
          }
        />
        {profile}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="main-img">
        <div className="video-tag">
          <video
            className="video-player"
            preload="metadata"
            controls
            autoPlay
            muted
            playsInline
            controlsList="nodownload"
            onError={handleError}
          >
            <source src={typeof src === "string" ? `${src}#t=0.2` : src} />
          </video>
        </div>
        {profile}
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="main-img">
        <div className="audio-video-tag home-music audio-tag">
          <audio controls controlsList="nodownload" onError={handleError}>
            <source src={src} />
          </audio>
        </div>
        {profile}
      </div>
    );
  }

  if (kind === "application") {
    return (
      <div className="pdf-style mb-md-3 mb-lg-3">
        <Document
          className="pdf-style pdf-card"
          file={src}
          onLoadSuccess={({ numPages: count }) => setNumPages(count)}
          onLoadError={handleError}
        >
          <Page pageNumber={pageNumber} className="pdf-style" />
        </Document>
        {numPages > 1 && (
          <p>
            Page {pageNumber} of {numPages}{" "}
            <button type="button" onClick={() => setPageNumber((n) => Math.max(1, n - 1))}>
              ‹
            </button>{" "}
            <button
              type="button"
              onClick={() => setPageNumber((n) => Math.min(numPages, n + 1))}
            >
              ›
            </button>
          </p>
        )}
        {profile}
      </div>
    );
  }

  if (["fbx", "gltf", "glb", "usdz", "obj"].includes(kind)) {
    if (isCarouselMobile && isActiveSlide === false) {
      return (
        <div className="main-img" style={{ height: "200px" }}>
          <div className="d-flex align-items-center justify-content-center h-100">
            {loader}
          </div>
        </div>
      );
    }
    return (
      <div className="main-img" id="fbx-id" style={{ height: height || "200px" }}>
        <FBXViewer
          ref={viewerRef}
          fbxPath={src}
          usdzPath={usdzPath || (kind === "usdz" ? src : null)}
          width="100%"
          height={height || "100%"}
          onReady={onModelReady}
          onErrorFallback={handleError}
          setFBXtoGBL={setFBXtoGBL}
          modelSlotIndex={modelSlotIndex}
          onRegisterStagedPath={onRegisterStagedPath}
          setIsActive={setIsActive}
        />
      </div>
    );
  }

  return (
    <div className="main-img dpmf-file-fallback">
      <p className="dpmf-muted">
        {kind.toUpperCase()} file
        {typeof image === "string" ? (
          <>
            {" — "}
            <a href={image} target="_blank" rel="noreferrer">
              open
            </a>
          </>
        ) : null}
      </p>
      {profile}
    </div>
  );
}

export default MediaKind;
