import "./App.css";
import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Outlet,
  Route,
  Routes
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { useJwt } from "react-jwt";
import { useSuppressResizeObserverError } from "./helper/userSuppressResizeObserverError";
import NftSuspenseLoader from "./components/common/NftSuspenseLoader";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Nft = React.lazy(() => import("./components/nft/nft"));
const Createnft = React.lazy(() => import("./components/nft/Createnft"));
const Ownnft = React.lazy(() => import("./components/nft/ownnft"));
const Nftdetail = React.lazy(() => import("./components/nft/Nftdetail"));
const Nftlist = React.lazy(() => import("./components/nft/Nftlist"));
const BidDetail = React.lazy(() => import("./components/nft/biddetail"));
const Searchnft = React.lazy(() => import("./components/nft/searchNft"));
const InteroperabilityDetail = React.lazy(() =>
  import("./components/nft/interoperabilityDetail")
);
const DeclinedSendNFT = React.lazy(() =>
  import("./components/nft/declinedSendNFT")
);
const Ramp = React.lazy(() => import("./components/ramp/Ramp"));
const CancelPlacedOffer = React.lazy(() =>
  import("./components/nft/cancelPlacedOffer")
);
const BuyOfferReceived = React.lazy(() =>
  import("./components/nft/buyOfferReceived")
);
const Profile = React.lazy(() => import("./components/nft/profile"));
const VscoreDashboard = React.lazy(() =>
  import("./components/nft/vScoreDashboard")
);
const Collections = React.lazy(() => import("./components/nft/collections"));
const XioDashboard = React.lazy(() => import("./components/nft/xioDashboard"));

function App() {
  useSuppressResizeObserverError();
  const token = localStorage.getItem("jwtToken");
  const { isExpired } = useJwt(token);

  const PrivateRoute = () => {
    return token !== null && isExpired === false ? (
      <Outlet />
    ) : (
      <Navigate to="/" />
    );
  };

  return (
    <Router>
      <Suspense fallback={<NftSuspenseLoader />}>
        <Routes>
          <Route path="/" element={<Nft />} />
          <Route path="/Nftdetail/:id" element={<Nftdetail />} />
          <Route
            path="/InteroperabilityDetail/:id"
            element={<InteroperabilityDetail />}
          />
          <Route path="/Nftlist/:type" element={<Nftlist />} />
          <Route path="/BidDetail/:id" element={<BidDetail />} />
          <Route path="/Searchnft" element={<Searchnft />} />
          <Route path="/Profile/:id" element={<Profile />} />
          <Route path="/collections" element={<Collections />} />

          <Route element={<PrivateRoute />}>
            <Route path="/Createnft" element={<Createnft />} />
            <Route path="/MyNFT" element={<Ownnft />} />
            <Route path="/DeclinedSendNFT" element={<DeclinedSendNFT />} />
            <Route path="/ramp" element={<Ramp />} />
            <Route path="/Cancelplacedoffer" element={<CancelPlacedOffer />} />
            <Route path="/BuyOfferReceived" element={<BuyOfferReceived />} />
            <Route path="/Profile" element={<Profile />} />
            <Route path="/Vscoredashboard" element={<VscoreDashboard />} />
            <Route path="/Xiodashboard" element={<XioDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      <ToastContainer
        limit={1}
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnFocusLoss={false}
        pauseOnHover={false}
      />
    </Router>
  );
}

export default App;
