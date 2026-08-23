import React, { forwardRef } from "react";
import MediaKind from "./MediaKind";

const Filetypecomman = forwardRef((props, ref) => (
  <MediaKind {...props} viewerRef={ref} variant="detail" height={props.height} />
));

export default Filetypecomman;
