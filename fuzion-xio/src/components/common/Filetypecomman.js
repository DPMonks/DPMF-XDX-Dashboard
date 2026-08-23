import React, { useState, useEffect, forwardRef } from "react";
import Card from "react-bootstrap/Card";
import { Document, Page, pdfjs } from "react-pdf";
import FBXViewer from "./FbxViewer";
import configData from "../../config.json";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
);

const Filetypecomman = forwardRef((props, ref) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [src, setSrc] = useState(props.image);

  useEffect(() => {
    setSrc(props.image);
  }, [props.image]);

  const withProxy = (url) =>
    `${configData.LOCAL_API_URL}assets?url=${encodeURIComponent(url)}`;

  const handleError = () => {
    // retry only once
    if (src === props.image) {
      setSrc(withProxy(props.image));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => setPageNumber((p) => (p - 1 <= 1 ? 1 : p - 1));

  const goToNextPage = () =>
    setPageNumber((p) => (p + 1 >= numPages ? numPages : p + 1));

  return (
    <>
      {(() => {
        /* IMAGE / GIF */
        if (props.fileType === "image" || props.fileType === "gif") {
          return (
            <div className="main-img detail_nft">
              <Card.Img
                variant="top"
                src={src}
                className="min-height-200-new11"
                onError={handleError}
              />
            </div>
          );
        }

        /* VIDEO */
        if (props.fileType === "video") {
          return (
            <div className="main-img detail_nft">
              <div className="video-tag-common">
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
                  <source src={src + "#t=0.2"} />
                </video>
              </div>
            </div>
          );
        }

        /* AUDIO */
        if (props.fileType === "audio") {
          return (
            <div className="main-img detail_nft">
              <div className="audio-video-tag-common audio-height home-music detailAudio">
                <audio controls controlsList="nodownload" onError={handleError}>
                  <source src={src} />
                </audio>
              </div>
            </div>
          );
        }

        /* PDF */
        if (props.fileType === "application" || props.fileType === "pdf") {
          return (
            <div className="pdf-style detail_pdf">
              <Document
                className="pdf-style"
                file={src}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={handleError}
              >
                <Page pageNumber={pageNumber} className="pdf-style" />
              </Document>

              <p>
                Page: {pageNumber} of {numPages}
              </p>

              <i
                aria-hidden="true"
                className="fa fa-arrow-circle-left"
                style={{ fontSize: "24px", cursor: "pointer" }}
                onClick={goToPrevPage}
              />
              <i
                aria-hidden="true"
                className="fa fa-arrow-circle-right"
                style={{ fontSize: "24px", cursor: "pointer" }}
                onClick={goToNextPage}
              />
            </div>
          );
        }

        /* FBX / GLB / GLTF */
        if (["fbx", "gltf", "glb"].includes(props.fileType)) {
          return (
            <div className="main-img detail_nft" id="fbx-id">
              <FBXViewer
                ref={ref}
                fbxPath={src}
                usdzPath={props.usdzPath}
                setIsActive={props.setIsActive}
                width="100%"
                height={props?.height || "100%"}
                onErrorFallback={handleError}
              />
            </div>
          );
        }

        return null;
      })()}
    </>
  );
});

export default Filetypecomman;
