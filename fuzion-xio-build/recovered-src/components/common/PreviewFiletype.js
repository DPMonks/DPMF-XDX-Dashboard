import React, { useState, useEffect } from "react";
import Card from "react-bootstrap/Card";
import { Document, Page, pdfjs } from "react-pdf";
import FBXViewer from "./FbxViewer";
import config from "../../config.json";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
);

const withProxy = (url) =>
  `${config.LOCAL_API_URL}assets?url=${encodeURIComponent(url)}`;

function PreviewFiletype(props) {
  const [pageNumber, setNumPages] = useState(1);
  const [src, setSrc] = useState(props.image);

  useEffect(() => {
    setSrc(props.image);
  }, [props.image]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleError = () => {
    if (src === props.image) {
      setSrc(withProxy(props.image));
    }
  };

  return (
    <>
      {(() => {
        if (props.fileType === "image" || props.fileType === "gif") {
          return (
            <div className="main-img md-3 img_preview">
              <Card.Img
                variant="top"
                src={src}
                onError={handleError}
                className="min-height-200-new11 img_max_preview"
              />
            </div>
          );
        }

        if (props.fileType === "video") {
          return (
            <div className="main-img img_preview">
              <div className="video-tag-common img_max_preview">
                <video
                  className="video-player"
                  preload="metadata"
                  controls
                  autoPlay
                  muted
                  controlsList="nodownload"
                  onError={handleError}
                >
                  <track kind="captions" label="" />
                  <source src={src + "#t=0.2"} />
                </video>
              </div>
            </div>
          );
        }

        if (props.fileType === "audio") {
          return (
            <div className="main-img img_preview previewmusiccstm">
              <div className="audio-video-tag-common audio-height_img_preview img_max_preview">
                <audio controls controlsList="nodownload" onError={handleError}>
                  <track kind="captions" label="" />
                  <source src={src} />
                </audio>
              </div>
            </div>
          );
        }

        if (props.fileType === "application") {
          return (
            <div className="pdf-style pdf-preview-cstm">
              <Document
                file={src}
                onLoadError={handleError}
                onLoadSuccess={onDocumentLoadSuccess}
              >
                <Page pageNumber={pageNumber} className="pdf-style" />
              </Document>
            </div>
          );
        }

        if (["fbx", "gltf", "glb"].includes(props.fileType)) {
          return (
            <div className="main-img md-3 img_preview" id="fbx-id">
              <FBXViewer
                fbxPath={src}
                width={133}
                height={122}
                setFBXtoGBL={props.setFBXtoGBL}
                modelSlotIndex={props.modelSlotIndex}
                onErrorFallback={handleError}
                onRegisterStagedPath={props.onRegisterStagedPath}
              />
            </div>
          );
        }

        return null;
      })()}
    </>
  );
}

export default React.memo(PreviewFiletype);
