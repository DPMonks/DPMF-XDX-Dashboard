import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Table, Container, Button } from "react-bootstrap";
import { useDispatch } from "react-redux";
import Header from "../common/header";
import Footer from "../common/footer";
import { cancelSendNftAction } from "../../store/actions/mintNFT";
import MessageConst from "../../const/message.json";
import { getXioDashboardAction } from "../../store/actions/profile";
import DummyProfile from "../../assets/defaultpimage.jpg";
import configData from "../../config.json";
import { getProfileAction } from "../../store/actions/profile";
import { replaceHost } from "../../helper";

function XioDashboard() {
  const [searchKey, setSearchKey] = useState(true);
  const [xioDashboard, setXioDashboard] = useState(null);
  const [loaderId, setLoaderId] = useState(null);
  const [allProfile, setAllProfile] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = localStorage.getItem("jwtToken");

  // ===========Declined receive nft record======
  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" })).then((pDetail) => {
      setAllProfile(pDetail?.data?.allProfile);
    });
    dispatch(getXioDashboardAction({ token }))
      .then((val) => {
        setXioDashboard(val?.data?.xioDashboardData);
      })
      .catch((e) => console.log("Error XIO dashboard", e));
  }, [token]); // eslint-disable-line

  const rankFilter = (balance) => {
    if (+balance > 0 && +balance <= 0.000999999999999) {
      return "New Validator";
    }
    if (+balance >= 0.001 && +balance <= 0.00999999999999) {
      return "Beginner Validator";
    }
    if (+balance >= 0.01 && +balance <= 0.099999999999999) {
      return "Basic Validator";
    }
    if (+balance >= 0.1 && +balance <= 0.99999999999999) {
      return "Validator";
    }
    if (+balance >= 1 && +balance <= 9.999999999999999) {
      return "Active Validator";
    }
    if (+balance >= 10 && +balance <= 99.999999999999999) {
      return "Trusted Validator";
    }
    if (+balance >= 100) {
      return "Master Validator";
    }
  };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4 declinedSection">
          <>
            <Container>
              <br />
              <h3 className=" mb-5">XIO Validator Dashboard</h3>
              <div className="table-responsive">
                <Table className="table-class">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Image</th>
                      <th>wallet Address</th>
                      <th>Ranking</th>
                      {/* <th>Issuer Address</th> */}
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!!xioDashboard &&
                      (xioDashboard.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center">
                            No Records Found
                          </td>
                        </tr>
                      ) : (
                        xioDashboard
                          .sort((a, b) => b.balance.value - a.balance.value)
                          .map((val, key) => {
                            return (
                              <tr key={key}>
                                <td>{key + 1}</td>
                                <td>
                                  <img
                                    width={30}
                                    height={30}
                                    alt=""
                                    src={
                                      allProfile?.find(
                                        (vl) =>
                                          vl.wAddress === val?.accountNumber
                                      )?.pImage
                                        ? allProfile
                                            ?.find(
                                              (vl) =>
                                                vl.wAddress ===
                                                val?.accountNumber
                                            )
                                            ?.pImage?.startsWith("https://ipfs")
                                          ? replaceHost(
                                              allProfile?.find(
                                                (vl) =>
                                                  vl.wAddress ===
                                                  val?.accountNumber
                                              )?.pImage
                                            )
                                          : allProfile
                                              ?.find(
                                                (vl) =>
                                                  vl.wAddress ===
                                                  val?.accountNumber
                                              )
                                              ?.pImage?.startsWith("uploads")
                                          ? `${
                                              configData.LOCAL_API_URL +
                                              allProfile?.find(
                                                (vl) =>
                                                  vl.wAddress ===
                                                  val?.accountNumber
                                              )?.pImage
                                            }`
                                          : DummyProfile
                                        : DummyProfile
                                    }
                                    className="img-dashboard"
                                  />
                                </td>
                                <td>
                                  <Link
                                    // target="_blank"
                                    rel="noreferrer"
                                    to={`/Profile/${val?.accountNumber}`}
                                    // href={`https://bithomp.com/explorer/${val?.accountNumber}`}
                                    // className="text-dark"
                                  >
                                    {val.accountNumber.substring(0, 9)} *****{" "}
                                    {val.accountNumber.substring(
                                      val.accountNumber.length - 5
                                    )}
                                  </Link>
                                </td>
                                <td width="40%">
                                  {rankFilter(val.balance.value)}
                                </td>
                                <td>{val.balance.value}</td>
                              </tr>
                            );
                          })
                      ))}
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
export default XioDashboard;
