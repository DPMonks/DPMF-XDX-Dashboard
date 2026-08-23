import React from "react";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import MessageConst from "../../../const/message.json";
import { useJwt } from "react-jwt";
import { likeDispach } from "../../../store/actions/like";
import { useLocation } from "react-router-dom";

function Like(props) {
  const token = localStorage.getItem("jwtToken");
  const { decodedToken } = useJwt(token);
  const { pathname } = useLocation();

  let dispatch = useDispatch();
  // const [likeCheck, setLikeCheck] = useState(false);
  const likeDislike = async (val) => {
    // console.log("sadfasdfasfdasdfasdf", val);
    // setLikeCheck(true);
    try {
      //check user
      if (decodedToken === null) {
        toast.warn(MessageConst.errorConnectXummWallet, {
          toastId: "NFTLike" + Date.now()
        });
        return;
      }

      let data = {
        nftID: val
      };
      dispatch(likeDispach({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "likeerror" + Date.now()
      });
    }
  };

  const userToken =
    pathname.split("/")?.length < 3
      ? decodedToken?.ac
      : pathname.split("/")?.pop();

  return (
    <p className="d-flex align-items-center">
      {/* {console.log(props.post, "props.post")} */}
      {(() => {
        if (
          userToken &&
          props.post?.find(({ accountNumber }) => accountNumber === userToken)
        ) {
          return (
            <>
              <div
                className="like-button liked"
                onClick={() => likeDislike(props.id)}
              >
                <span className="like-icon">
                  <div className="heart-animation-1"></div>
                  <div className="heart-animation-2"></div>
                </span>
              </div>
            </>
          );
        } else {
          return (
            <>
              <div
                className="like-button"
                onClick={() => likeDislike(props.id)}
              >
                <span className="like-icon">
                  <div className="heart-animation-1"></div>
                  <div className="heart-animation-2"></div>
                </span>
              </div>
            </>
          );
        }
      })()}
      <span className="fa-fa-font-white-text">{props.post?.length}</span>
    </p>
  );
}
export default Like;
