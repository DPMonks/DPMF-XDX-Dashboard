import Header from "../common/header";
import Footer from "../common/footer";

export default function Ramp() {
  return (
    <>
    <Header />
    <div className="gradientBg createNewNFT"  align="center">
        <iframe
          src="https://ramp-beta.stably.io"
          height="680"
          width="420"
          className="mt-3 mb-3"
          title="myFrame"
        ></iframe>
      </div>
      <Footer />
    </>
  );
}
