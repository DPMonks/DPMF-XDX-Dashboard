import React, { useState, useEffect } from "react";
import Card from "react-bootstrap/Card";
import { Document, Page, pdfjs } from "react-pdf";
import LazyLoad, { forceVisible } from "react-lazyload";
import FBXViewer from "./FbxViewer";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
);

function Filetype(props) {
  const [pageNumber, setNumPages] = useState(1);
  const [src, setSrc] = useState(props.image);

  useEffect(() => {
    setSrc(props.image);
  }, [props.image]);

  useEffect(() => {
    if (props.layout) {
      setTimeout(() => {
        forceVisible();
      }, 2500);
    }
  }, [props.layout]);

  const withProxy = (url) => "/assets?url=" + encodeURIComponent(url);

  const handleError = () => {
    // retry only once
    if (src === props.image) {
      setSrc(withProxy(props.image));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const loader = (
    <div className="three-body">
      <div className="three-body__dot"></div>
      <div className="three-body__dot"></div>
      <div className="three-body__dot"></div>
    </div>
  );

  return (
    <>
      {(() => {
        /* IMAGE / GIF */
        if (props.fileType === "image" || props.fileType === "gif") {
          return (
            <LazyLoad height={200} offset={100} placeholder={loader}>
              <div className="main-img">
                <Card.Img
                  variant="top"
                  src={src}
                  onError={handleError}
                  className="min-height-200-new imgRadius mb-md-3"
                />

                {!!props.profileImg && (
                  <div className="img-box-home">
                    <div className="proFile">
                      <img
                        src={props.profileImg}
                        alt=""
                        className={`inner-ing ${src}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </LazyLoad>
          );
        }

        /* VIDEO */
        if (props.fileType === "video") {
          return (
            <LazyLoad height={200} offset={100} placeholder={loader}>
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
                    <source src={src + "#t=0.2"} />
                  </video>
                </div>

                {!!props.profileImg && (
                  <div className="img-box-home">
                    <div className="proFile">
                      <img
                        src={props.profileImg}
                        alt=""
                        className={`inner-ing ${src}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </LazyLoad>
          );
        }

        /* AUDIO */
        if (props.fileType === "audio") {
          return (
            <LazyLoad height={200} offset={100} placeholder={loader}>
              <div className="main-img">
                <div className="audio-video-tag home-music audio-tag">
                  <audio
                    controls
                    controlsList="nodownload"
                    onError={handleError}
                  >
                    <source src={src} />
                  </audio>
                </div>

                {!!props.profileImg && (
                  <div className="img-box-home">
                    <div className="proFile">
                      <img
                        src={props.profileImg}
                        alt=""
                        className={`inner-ing ${src}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </LazyLoad>
          );
        }

        /* PDF */
        if (props.fileType === "application") {
          return (
            <LazyLoad height={200} offset={100} placeholder={loader}>
              <div className="pdf-style mb-md-3 mb-lg-3">
                <Document
                  className="pdf-style pdf-card"
                  file={src}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={handleError}
                >
                  <Page pageNumber={pageNumber} className="pdf-style" />
                </Document>

                {!!props.profileImg && (
                  <div className="img-box-home">
                    <div className="proFile">
                      <img
                        src={props.profileImg}
                        alt=""
                        className={`inner-ing ${src}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </LazyLoad>
          );
        }

        /* FBX / GLB / GLTF */
        if (["fbx", "gltf", "glb"].includes(props.fileType)) {
          if (props.isCarouselMobile && props.isActiveSlide === false) {
            return (
              <div className="main-img" style={{ height: "200px" }}>
                <div
                  className="d-flex align-items-center justify-content-center h-100"
                  aria-hidden="true"
                >
                  {loader}
                </div>
              </div>
            );
          }

          return (
            <LazyLoad height={200} offset={100} placeholder={loader}>
              <div className="main-img" id="fbx-id" style={{ height: "200px" }}>
                <FBXViewer
                  fbxPath={src}
                  width="100%"
                  height="100%"
                  onReady={props.onModelReady}
                  onErrorFallback={handleError}
                />
              </div>
            </LazyLoad>
          );
        }

        return null;
      })()}
    </>
  );
}

export default Filetype;
