import React from "react";
import MediaKind from "./MediaKind";

function PreviewFiletype(props) {
  return <MediaKind {...props} variant="preview" />;
}

export default React.memo(PreviewFiletype);
