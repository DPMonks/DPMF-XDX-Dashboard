import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Container } from "react-bootstrap";
import { useDispatch } from "react-redux";
import Header from "../common/header";
import Footer from "../common/footer";
import { allOfferByNftOwnerAction } from "../../store/actions/mintNFT";
// import MessageConst from "../../const/message.json";

function BuyOfferReceived() {
  const [searchKey, setSearchKey] = useState(true);
  const [notifications, setNotification] = useState(null);
  // const [loaderId, setLoaderId] = useState(null);
  const dispatch = useDispatch();
  const token = localStorage.getItem("jwtToken");

  /* All offer by nft owner */
  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
    if (!!token) {
      dispatch(allOfferByNftOwnerAction())
        .then((val) => {
          setNotification(val.data.totalOffer);
        })
        .catch((e) => {
          console.log("Error all offer by nft owner:", e);
        });
    }
  }, [token]); // eslint-disable-line

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4 declinedSection">
          <>
            <Container>
              <br />
              <h5 className="text-white mb-5">Buy Offers Received</h5>
              <div className="table-responsive">
                <Table className="table-class">
                  <thead>
                    <tr>
                      <th>Buyer's Address</th>
                      <th>NFT ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications !== null &&
                      notifications.map((val, key) => {
                        return (
                          <tr key={key}>
                            <td>
                              {val.nft_buyer.substring(0, 9)} *****{" "}
                              {val.nft_buyer.substring(
                                val.nft_buyer.length - 5
                              )}
                            </td>
                            <td>
                              <a
                                target="_blank"
                                rel="noreferrer"
                                href={`https://bithomp.com/explorer/${val?.nft_id}`}
                                className="text-dark"
                              >
                                {val.nft_id.substring(0, 9)} *****{" "}
                                {val.nft_id.substring(val.nft_id.length - 5)}
                              </a>
                            </td>
                            <td width="40%">
                              <Link
                                className="BuyNFT btn btn-success"
                                to={"../Nftdetail/" + val.nftObjId}
                              >
                                {" "}
                                Get Details{" "}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </Table>
              </div>
            </Container>
          </>
        </div>
      )}
      <Footer />
    </>
  );
}
export default BuyOfferReceived;
