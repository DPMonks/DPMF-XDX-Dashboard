import React from "react";
import LazyLoad, { forceVisible } from "react-lazyload";
import MediaKind from "./MediaKind";

function Filetype(props) {
  if (props.layout) {
    setTimeout(() => forceVisible(), 2500);
  }
  return (
    <LazyLoad height={200} offset={100}>
      <MediaKind {...props} variant="card" />
    </LazyLoad>
  );
}

export default Filetype;
