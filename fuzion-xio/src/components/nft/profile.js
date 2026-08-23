import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useTransition,
  useMemo
} from "react";
import Header from "../common/header";
import Avatar from "react-avatar-edit";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Swal from "sweetalert2";
import axios from "axios";
// import Pagination from "react-bootstrap/Pagination";
import { decodeToken } from "react-jwt";
import configData from "../../config.json";
import MessageConst from "../../const/message.json";
import { BeatLoader } from "react-spinners";
import {
  Container,
  Row,
  Col,
  Button,
  FloatingLabel,
  Card,
  CardImg,
  Modal,
  Form
} from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { profileBatchColor } from "../../helper/getProfileDetails";
import SocialSitesLink from "../common/Socialsiteslinks";
import Footer from "../common/footer";
import NFT from "../../assets/profilelargebanner.png";
import NFT2 from "../../assets/profilesmallbanner.jpg";
import NFT3 from "../../assets/defaultpimage.jpg";
import QrCodeImgTest from "../../assets/qr_code_test.jpeg";
import WEBSITEIMG from "../../assets/website.jpg";
// Dummy Image
import DummyProfile from "../../assets/defaultpimage.jpg";
import { Link } from "react-router-dom";
import Filetype from "../common/Filetype";
import { getProfileDetails } from "../../helper/getProfileDetails";
import tokenbadge from "../../../src/assets/tokenimg.png";
import * as Spinners from "react-loader-spinner";

import Like from "./like/like";
// import { create as ipfsHttpClient } from 'kubo-rpc-client';
// import { create as ipfsHttpClient } from "ipfs-http-client";
import ContentEditable from "react-contenteditable";

// crop square image
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import {
  createProfileAction,
  getProfileAction,
  getBalAndLevelAction,
  validateProfileAction,
  getProfileVScoreAction
} from "../../store/actions/profile";
import {
  getBalanceAction,
  getMintedOffersByIsser
} from "../../store/actions/wallet";
import { actionTypes as walletActionTypes } from "../../store/actionTypes/wallet";

// image debounce
import { useDebounceEffect } from "../../helper/useDebounceEffect";
import { canvasPreview } from "../../helper/canvasPreview";
import {
  getCollections,
  removeNftCollection
} from "../../store/actions/nftdetail";
import { convertToFile } from "../../helper/convertBase64";
import { profileShareUrl, setProfileSocialMeta } from "../../helper/profileMedia";
import {
  uniqueArray,
  replaceHost,
  extractCIDFromURL,
  checkImageExists,
  cancelTransactionPolling,
  encodeUnicodeToBase64
} from "../../helper";
import { isMobile } from "react-device-detect";
import BUYERNFT from "../../assets/buyerNft.jpg";
import ProgressBarComponent from "../Progressbar";
import ShowQRModal from "../common/ShowQRModel";

const COLLECTIONS_PER_PAGE = 8;
const MOBILE_COLLECTIONS_PER_PAGE = 6;
const MODEL_DRAG_THRESHOLD = 8;

const normalizeCollectionContentType = (contentType) => {
  if (!contentType) return "image";
  if (contentType === "model/gltf-binary") return "glb";
  if (contentType === "model/gltf+json" || contentType === "model/gltf") {
    return "gltf";
  }
  if (contentType === "model/fbx") return "fbx";
  return contentType.includes("/") ? contentType.split("/")[0] : contentType;
};

const isInteractive3DType = (contentType) =>
  ["fbx", "gltf", "glb", "model"].includes(contentType);

/*IPFS configuration code */
// const projectId = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID;
// const projectSecret = process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
// const projectIdAndSecret = `${projectId}:${projectSecret}`;

// const client = ipfsHttpClient({
//   host: configData.HOST_IPFS,
//   port: configData.PORT_IPFS,
//   protocol: configData.PROTOCOL_IPFS,
//   headers: {
//     authorization: `Basic ${Buffer.from(projectIdAndSecret).toString(
//       "base64"
//     )}`,
//   },
// });

const centerAspectCrop = (mediaWidth, mediaHeight, aspect) => {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
};

/* Profile component */
const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const modelInteractionRef = useRef({});
  const readyCollectionModelsRef = useRef(new Set());
  const HOST = window.location.href;

  // const now = 10;
  const [searchKey, setSearchKey] = useState(true);
  const [isPaid, setIsPaid] = useState(null);
  const [dialog, setDialog] = useState(false);
  const [showdialog, setshowdialog] = useState(false);
  const [cropImg, setCropImg] = useState(false);
  const [storeImage, setstoreImage] = useState(null);
  const [showcollect, setShowcollect] = useState(true);
  const [socialHandles, setSocialHandles] = useState(null);
  const [backDialog, setBackDialog] = useState(false);
  const [dBannerDialog, setDBannerDialog] = useState(false);
  const [storeBackImage, setStoreBackImage] = useState(null);
  const [storeDBannerImg, setStoreDBannerImg] = useState(null);
  const [pName, setPName] = useState(null);
  const [bio, setBio] = useState(null);
  const [tagline, setTagline] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [editProfileName, setEditProfileName] = useState(false);
  const [eidtBio, setEidtBio] = useState(false);
  const [pDetails, setPDetails] = useState(null);
  const [rdxBalance, setRdxBalance] = useState(null);
  const [verifyModal, setVerifyModal] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [addTokenAmount, setAddTokenAmount] = useState(null);
  const [tokenTicker, setTokenTicker] = useState(null);
  const [currency, setCurrency] = useState("");
  const [vAmount, setVAmount] = useState("XRP 0.1");
  const [vScore, setVScore] = useState(null);
  const [validatorAdd, setValidatorAdd] = useState(null);
  const [collections, setCollections] = useState(null);
  const [allProfile, setAllProfile] = useState(null);
  const [allMintedNfts, setAllMintedNfts] = useState(null);
  const [layout, setLayout] = useState(false);
  const [isLoader, setIsLoader] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [profileCollections, setProfileCollections] = useState(null);
  const [profileNfts, setProfileNfts] = useState(null);
  const [collectionsViewPage, setCollectionsViewPage] = useState(0);
  const [mobileActiveModelCount, setMobileActiveModelCount] = useState(0);
  const [fourthCurr, setFourthCurr] = useState(null);
  const [issuerNFT, setIssuerNFT] = useState(null);

  // image crop states
  const blobUrlRef = useRef("");
  const previewCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState("");
  const [completedCrop, setCompletedCrop] = useState("");
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);
  const [page, setPage] = useState(1);

  const [isPending, startTransition] = useTransition();

  // states
  const [homedtl, likeStatus] = useSelector((state) => [
    state.homeDetailReducer,
    state.nftLikeReducer
  ]);
  const [
    createProfile,
    balance,
    validateProfile,
    nftCollection,
    { mintedOffers }
  ] = useSelector((state) => [
    state.createProfileReducer,
    state.getBalanceReducer,
    state.validateProfileReducer,
    state.collectionReducer,
    state.walletActionReducer
  ]);
  const qrModal = useSelector((state) => state.qrModal);

  const dismissQrIfOpen = useCallback(() => {
    if (!qrModal.visible) return;
    if (qrModal.uuid) cancelTransactionPolling(qrModal.uuid);
    dispatch({ type: walletActionTypes.HIDE_PAYMENT_QR });
  }, [dispatch, qrModal.visible, qrModal.uuid]);

  useEffect(() => {
    if (!qrModal.visible) return;
    setDialog(false);
    setshowdialog(false);
    setBackDialog(false);
    setDBannerDialog(false);
    setVerifyModal(false);
    setShowAddTokenModal(false);
  }, [qrModal.visible]);

  const DATE_OPTIONS = {
    year: "numeric",
    month: "short",
    day: "numeric"
  };

  const token = localStorage.getItem("jwtToken");
  const myDecodedToken = decodeToken(token);

  const handlePagination = (e) => {
    setPage(e);
  };

  const getImageURL = async (url) => {
    const CID = extractCIDFromURL(url);
    return (await checkImageExists(CID)) ? replaceHost(url) : url;
  };

  const checkValidProfile = () => {
    if (pathname.split("/").length === 3) {
      if (pathname.split("/").pop() === myDecodedToken?.ac) {
        return true;
      }
    } else if (pathname.split("/").length === 2) {
      return true;
    } else {
      return false;
    }
  };

  const walletToken = checkValidProfile()
    ? myDecodedToken?.ac
    : pathname.split("/").pop();

  // Memoized unique collections
  const uniqueCollections = useMemo(() => {
    return uniqueArray(profileCollections || [], walletToken);
  }, [profileCollections, walletToken]);

  const collectionsPerPage = isMobile
    ? MOBILE_COLLECTIONS_PER_PAGE
    : COLLECTIONS_PER_PAGE;

  const totalCollectionPages = Math.max(
    1,
    Math.ceil(uniqueCollections.length / collectionsPerPage)
  );

  const visibleCollections = useMemo(() => {
    const start = collectionsViewPage * collectionsPerPage;
    return uniqueCollections.slice(start, start + collectionsPerPage);
  }, [collectionsPerPage, collectionsViewPage, uniqueCollections]);

  const visibleCollectionModelIds = useMemo(
    () =>
      visibleCollections
        .filter((collection) => isInteractive3DType(collection.contentType))
        .map((collection) => collection._id),
    [visibleCollections]
  );

  useEffect(() => {
    if (!isMobile) {
      readyCollectionModelsRef.current = new Set();
      setMobileActiveModelCount(visibleCollectionModelIds.length);
      return;
    }

    readyCollectionModelsRef.current = new Set();
    setMobileActiveModelCount(visibleCollectionModelIds.length > 0 ? 1 : 0);
  }, [isMobile, visibleCollectionModelIds]);

  const handleMobileCollectionModelReady = useCallback(
    (collectionId) => {
      if (!isMobile || !collectionId) return;
      if (readyCollectionModelsRef.current.has(collectionId)) return;

      readyCollectionModelsRef.current.add(collectionId);
      setMobileActiveModelCount((currentCount) =>
        Math.min(currentCount + 1, visibleCollectionModelIds.length)
      );
    },
    [isMobile, visibleCollectionModelIds.length]
  );

  const handleRemoveCollection = (val) => {
    Swal.fire({
      title: "Are you sure?",
      text: "Once deleted, you will not be able to recover this Collection!",
      type: "danger",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, remove it!",
      cancelButtonText: "No, cancel please!"
    }).then((result) => {
      if (result.isConfirmed) {
        const { collectionName, isPurchased, accountNumber } = val;
        dispatch(
          removeNftCollection({ collectionName, isPurchased, accountNumber })
        ).then((res) => {
          const { success } = res.data;
          if (success) {
            toast.error(MessageConst.DELETEFROMCOLLECTION, {
              toastId: "deletecollection1" + Date.now(),
              onClose: async () => {
                // setProfileCollections(res.data.data.docs);
                await handleInitialCall(walletToken);
              }
            });
          }
        });
      } else {
        return;
      }
    });
  };

  const handleInitialCall = useCallback(async (wToken) => {
    try {
      const config = {
        headers: {
          Authorization: `Basic ${token}`
        }
      };

      const data = { walletAddress: wToken };

      const [byCollection, desk] = await Promise.all([
        axios.post(
          `${configData.LOCAL_API_URL}nft/getSingleUserNftsByCollections`,
          data,
          config
        ),
        axios.get(`${configData.LOCAL_API_URL}profiles/${encodeURIComponent(wToken)}/nfts`)
      ]);

      const docs = (desk.data?.data?.docs || byCollection.data?.data?.docs || []).map(
        (doc) => ({
          ...doc,
          contentType: normalizeCollectionContentType(doc.contentType)
        })
      );
      setProfileNfts(docs);
      if (byCollection.data?.success) {
        setProfileCollections(docs);
      }
    } catch (error) {
      setProfileNfts([]);
      setProfileCollections([]);
      toast.error(error?.response?.data?.message || "Something went wrong", {
        toastId: "updateProfile3" + Date.now()
      });
    }
  }, []); // Dependencies for useCallback

  const getVScore = (NFTokenID) => {
    const IssuerToken = allMintedNfts?.find((vl) => vl.NFTokenID === NFTokenID);
    return dispatch(getProfileVScoreAction({ wAddress: IssuerToken?.Issuer }))
      .then((vScorePoint) => {
        if (vScorePoint) {
          const { vPointDetails } = vScorePoint?.data;
          return vPointDetails[0]?.totalVPoint;
        }
      })
      .catch((err) => console.log(err, "vpoint error"));
  };

  const bindVscoreData = async (data) => {
    return await Promise.all(
      data.docs.map(async (vl) => ({
        ...vl,
        vscore: vl?.NFTokenID ? await getVScore(vl.NFTokenID) : 0
      }))
    );
  };

  const displayColllect = () => setShowcollect((wasOpened) => !wasOpened);

  const handleModelPointerStart = useCallback((collectionId, event) => {
    modelInteractionRef.current[collectionId] = {
      x: event.clientX ?? event.touches?.[0]?.clientX ?? 0,
      y: event.clientY ?? event.touches?.[0]?.clientY ?? 0,
      moved: false
    };
  }, []);

  const handleModelPointerMove = useCallback((collectionId, event) => {
    const interaction = modelInteractionRef.current[collectionId];
    if (!interaction) return;

    const currentX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const currentY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;

    if (
      Math.abs(currentX - interaction.x) > MODEL_DRAG_THRESHOLD ||
      Math.abs(currentY - interaction.y) > MODEL_DRAG_THRESHOLD
    ) {
      interaction.moved = true;
    }
  }, []);

  const handleModelPointerEnd = useCallback(
    (collectionId, collectionTarget) => {
      const interaction = modelInteractionRef.current[collectionId];
      if (!interaction) return;

      if (!interaction.moved) {
        navigate(collectionTarget);
      }

      delete modelInteractionRef.current[collectionId];
    },
    [navigate]
  );

  const onCrop = (view) => {
    setCropImg(view);
  };

  // crop methods
  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImgSrc(reader.result?.toString() || "");
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e) => {
    if (aspect) {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  };

  const onDownloadCropClick = async () => {
    const image = imgRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!image || !previewCanvas || !completedCrop) {
      throw new Error("Crop canvas does not exist");
    }

    // This will size relative to the uploaded image
    // size. If you want to size according to what they
    // are looking at on screen, remove scaleX + scaleY
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const offscreen = new OffscreenCanvas(
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );
    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      throw new Error("No 2d context");
    }

    ctx.drawImage(
      previewCanvas,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height,
      0,
      0,
      offscreen.width,
      offscreen.height
    );

    // You might want { type: "image/jpeg", quality: <0 to 1> } to
    // reduce image size
    const blob = await offscreen.convertToBlob({
      type: "image/png"
    });

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
  };

  useDebounceEffect(
    async () => {
      if (
        completedCrop?.width &&
        completedCrop?.height &&
        imgRef.current &&
        previewCanvasRef.current
      ) {
        // We use canvasPreview as it's much faster than imgPreview.
        canvasPreview(
          imgRef.current,
          previewCanvasRef.current,
          completedCrop,
          scale,
          rotate
        );
      }
    },
    100,
    [completedCrop, scale, rotate]
  );

  useEffect(() => {
    if (mintedOffers && !!mintedOffers?.data) {
      const { NftDetails } = mintedOffers.data;
      setIssuerNFT(NftDetails);
    }
  }, [mintedOffers]);

  useEffect(() => {
    setCollectionsViewPage((currentPage) =>
      Math.min(currentPage, Math.max(totalCollectionPages - 1, 0))
    );
  }, [totalCollectionPages]);

  useEffect(() => {
    (async () => {
      await handleInitialCall(walletToken);
    })();
    dispatch(getMintedOffersByIsser(walletToken));
  }, []);

  useEffect(() => {
    dispatch(getCollections({ page, walletAddress: walletToken, type: 1 }));
  }, [page, likeStatus]);

  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" }))
      .then((pDetail) => {
        setAllProfile(pDetail.data.allProfile);
      })
      .catch((err) => console.log(err, "pdetails error"));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (homedtl.nftDetail !== "") {
      const { allMintedNft } = homedtl.nftDetail;
      setAllMintedNfts(allMintedNft);
    }
  }, [homedtl]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      if (!!nftCollection.nftCollections) {
        const { data } = nftCollection.nftCollections;
        if (data) {
          const finalData = await bindVscoreData(data);
          data.docs = await Promise.all(
            finalData.map(async (vl) => ({
              ...vl,
              image: await getImageURL(vl.image)
            }))
          );
          setCollections(data);
        }
      }
    })();
  }, [nftCollection]);

  useEffect(() => {
    if (!!storeDBannerImg && !dBannerDialog) {
      handleSubmit();
    }
  }, [storeDBannerImg, dBannerDialog]); // eslint-disable-line

  useEffect(() => {
    if (!!storeBackImage && !backDialog) {
      handleSubmit();
    }
  }, [storeBackImage, backDialog]);

  useEffect(() => {
    if (!!storeImage && !dialog) {
      handleSubmit();
    }
  }, [storeImage, dialog]);

  useEffect(() => {
    if (!!socialHandles && !showdialog) {
      handleSubmit();
    }
  }, [socialHandles, showdialog]);

  const saveImg = async () => {
    if (!cropImg) {
      return toast.error("Profile Image is required.", {
        toastId: "imgerror2" + Date.now(),
        onClose: () => {
          setIsLoader(false);
        }
      });
    }
    setstoreImage(cropImg);
    setDialog(false);
    // await handleSubmit()
  };

  const onClose = () => {
    setCropImg(null);
  };

  const handleClose = () => {
    setCropImg(null);
    setDialog(false);
  };

  const handleCloseTWo = () => setshowdialog(false);

  const handleClose1 = () => {
    setBackDialog(false);
    setStoreDBannerImg(null);
    setCompletedCrop("");
    setCrop("");
    setImgSrc("");
  };

  const handleClose2 = () => {
    setDBannerDialog(false);
    setStoreDBannerImg(null);
    setCompletedCrop("");
    setCrop("");
    setImgSrc("");
  };

  const saveBackImg = async () => {
    if (!crop) {
      return toast.error("Profile background Image is required.", {
        toastId: "imgerror1" + Date.now(),
        onClose: () => {
          setIsLoader(false);
        }
      });
    }

    const proImg = await onDownloadCropClick();

    setStoreBackImage(proImg);

    setBackDialog(false);
    // await handleSubmit();
  };

  const saveDBannerImg = async () => {
    if (!crop) {
      return toast.error("Profile Banner Image is required.", {
        toastId: "imgerror" + Date.now(),
        onClose: () => {
          setIsLoader(false);
        }
      });
    }

    const proImg = await onDownloadCropClick();

    setStoreDBannerImg(proImg);
    setIsLoader(false);
    setDBannerDialog(false);
  };

  const saveSociallink = () => {
    setshowdialog(false);
  };

  const handleChangeSocial = (e) => {
    const { name, value } = e.target;
    setSocialHandles({ ...socialHandles, [name]: value });
  };

  const handleName = (e) => {
    setPName(e.target.value);
  };

  const handleBio = (e) => {
    setBio(e.target.value);
  };

  const handleSubmit = async () => {
    setIsValid(true);
    if (
      !!pDetails
        ? myDecodedToken?.ac !== pDetails?.wAddress
        : pathname.split("/").length === 3 &&
          pathname.split("/").pop() !== myDecodedToken?.ac
    ) {
      setEditProfileName(false);
      return toast.warn(MessageConst.OWNPROFILECOND, {
        toastId: "updateownprofile" + Date.now()
      });
    }
    // let obj = [];
    const formData = new FormData();
    if (!!storeImage && storeImage !== "") {
      const pImage = await convertToFile(storeImage, "profile");
      formData.append("pImage", pImage);
      // obj.push({ pImage: storeImage });
    }
    if (!!socialHandles && Object.keys(socialHandles).length > 0) {
      formData.append("socialLinks", JSON.stringify([socialHandles]));
      // obj.push({ socialLinks: [socialHandles] });
    }
    if (!!storeBackImage && storeBackImage !== "") {
      const pBanner = await convertToFile(storeBackImage, "profile-banner");
      formData.append("pBanner", pBanner);
      // obj.push({ pBanner: storeBackImage });
    }
    if (!!storeDBannerImg && storeDBannerImg !== "") {
      const dBanner = await convertToFile(storeDBannerImg, "main-banner");
      formData.append("dBanner", dBanner);
      // obj.push({ dBanner: storeDBannerImg });
    }
    if (!!pName && pName !== "") {
      formData.append("pName", pName);
      // obj.push({ pName });
    }
    if (!!bio && bio !== "") {
      formData.append("bio", bio);
      // obj.push({ bio });
    }
    if (tagline) formData.append("tagline", tagline);
    if (location) formData.append("location", location);
    if (website) formData.append("website", website);
    if (!!myDecodedToken && myDecodedToken !== "") {
      formData.append("wAddress", myDecodedToken.ac);
      // obj.push({ wAddress: myDecodedToken.ac });
    }

    setEditProfileName(false);
    setStoreBackImage(null);
    // dispatch(
    //   createProfileAction({ data: Object.assign({}, ...obj), loader: true })
    // );
    setIsLoader(false);
    try {
      dispatch(createProfileAction({ data: formData, loader: true }));
    } catch (error) {
      console.log("errr", error);
    }
  };

  useEffect(() => {
    if (isValid) {
      if (createProfile.error === false) {
        toast.success(createProfile.createProfile.message, {
          toastId: "createProfile1" + Date.now(),
          onClose: () => {
            getProfileVscore();
            profileInfo();
            setRdxBlnc();
            setIsValid(false);
          }
        });
      } else if (createProfile.error !== null) {
        toast.error(createProfile.error.message, {
          toastId: "createProfile2" + Date.now(),
          onClose: () => {
            getProfileVscore();
            profileInfo();
            setRdxBlnc();
            setIsValid(false);
          }
        });
      }
    }
  }, [createProfile.error, isValid]); // eslint-disable-line

  const profileInfo = async () => {
    try {
      const pDetail = await dispatch(
        getProfileAction({ wAddress: walletToken })
      );

      const { data, allProfile } = pDetail?.data || {};

      if (
        Array.isArray(allProfile) &&
        allProfile.length > 0 &&
        myDecodedToken?.ac
      ) {
        const finalData = allProfile.find(
          (item) => item.wAddress === myDecodedToken.ac
        );

        if (finalData?.fourthCurrency) {
          setFourthCurr(finalData.fourthCurrency);
        }
      }

      if (data) {
        setPDetails(data);
        setTagline(data.tagline || "");
        setLocation(data.location || "");
        setWebsite(data.website || "");
        setProfileSocialMeta(data);
      }
    } catch (err) {
      console.error("pdetails error", err);
    }
  };

  const setRdxBlnc = () => {
    dispatch(
      getBalAndLevelAction({
        wAddress:
          pathname.split("/").length < 3
            ? myDecodedToken.ac
            : pathname.split("/").pop()
      })
    )
      .then((rdxBalDetail) => {
        setRdxBalance(rdxBalDetail.data);
      })
      .catch((err) => console.log(err, "rdxBalDetails error"));
  };

  useEffect(() => {
    profileInfo();
    setRdxBlnc();
  }, []); // eslint-disable-line

  const openVerifyModal = () => {
    if (!myDecodedToken || myDecodedToken?.ac === null) {
      return toast.warn(MessageConst.SIGNINTOVPROFILE, {
        toastId: "pverifyval" + Date.now()
      });
    }
    if (myDecodedToken?.ac === pDetails?.wAddress) {
      return toast.warn(MessageConst.PVERIFYVAL, {
        toastId: "pverifyval" + Date.now()
      });
    }
    if (isPaid === 0) {
      return toast.warn(MessageConst.ISACTIVEPROFILE, {
        toastId: "isActiveProfile" + Date.now()
      });
    } else {
      dismissQrIfOpen();
      setVerifyModal(true);
    }
  };

  const handleCloseVerify = () => setVerifyModal(false);

  /*Add Token code */
  const openAddToken = () => {
    if (!myDecodedToken || myDecodedToken?.ac === null) {
      return toast.warn(MessageConst.SIGNINTOVPROFILE, {
        toastId: "paddtoken" + Date.now()
      });
    }
    if (myDecodedToken?.ac !== pDetails?.wAddress) {
      return toast.warn(MessageConst.ADDOWNTOKENWARN, {
        toastId: "paddtoken1" + Date.now()
      });
    }
    dismissQrIfOpen();
    setShowAddTokenModal(true);
  };

  const closeAddTokenModal = () => setShowAddTokenModal(false);

  const handleAddTokenAmount = (e) => setAddTokenAmount(e.target.value);

  const addToken = () => {
    let decimalregex = /^\d{0,12}(\.\d{0,6})?$/;
    let decimalregex1 = /^\d{0,15}(\.\d{0,15})?$/;

    if (addTokenAmount === null || addTokenAmount === "") {
      toast.warn(MessageConst.FOURTH_CURR_AMOUNT, {
        toastId: "addToken1" + Date.now()
      });
      return;
    }

    if (!currency) {
      toast.warn(MessageConst.SELECT_CURRENCY, {
        toastId: "addToken2" + Date.now()
      });
      return;
    }
    if (currency === "XRP" && !decimalregex.test(addTokenAmount)) {
      return toast.warn(MessageConst.XRP_WRONG_DECIMAL, {
        toastId: "addToken3" + Date.now()
      });
    }
    if (currency !== "XRP" && !decimalregex1.test(addTokenAmount)) {
      return toast.warn(MessageConst.ISSUED_WRONG_DECIMAL, {
        toastId: "addToken4" + Date.now()
      });
    }

    setIsValid(true);

    const Issuer = tokenTicker.find((i) => {
      return i.curr === currency;
    });

    setAddTokenAmount(null);
    setCurrency("");

    // call api
    try {
      let fourthCurrency = {
        amount: addTokenAmount,
        currency: currency,
        issuerAdd: currency === "XRP" ? "" : Issuer.issuer
      };
      const formData = new FormData();
      formData.append("fourthCurrency", JSON.stringify(fourthCurrency));
      formData.append("wAddress", myDecodedToken.ac);

      setShowAddTokenModal(false);

      //   // call api
      dispatch(
        createProfileAction({
          data: formData,
          loader: true
        })
      );
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "sendToken1" + Date.now()
      });
    }
  };

  const handleCurrency = (e) => setCurrency(e.target.value);

  useEffect(() => {
    if (balance?.currency !== null) {
      if (balance?.currency?.currency) {
        setTokenTicker(balance?.currency?.currency);
      } else {
        setTokenTicker([]);
      }
    }
  }, [balance]); // eslint-disable-line

  useEffect(() => {
    try {
      if (localStorage.getItem("jwtToken") !== null) {
        let data = {
          token: localStorage.getItem("jwtToken")
        };
        dispatch(getBalanceAction({ data, loader: true }));
      }
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "connectWallet1" + Date.now()
      });
    }
  }, [localStorage.getItem("jwtToken")]); // eslint-disable-line

  const adjustCurrency = (value) => {
    const currency = value.split(" ")[0];
    const amount = value.split(" ")[1];
    if (currency === "XRP") {
      return { currency, amount };
    } else if (currency === "XDX") {
      return { currency, amount };
    } else if (currency === "XSQUAD") {
      return { currency: "5853515541440000000000000000000000000000", amount };
    } else {
      return pDetails?.fourthCurrency;
    }
  };

  const ValidProfile = async () => {
    setIsValid(true);
    if (vAmount === null || vAmount === "") {
      return toast.warn(MessageConst.VALIDATEPAYMENT, {
        toastId: "vprofile1" + Date.now(),
        onClose: () => setIsValid(false)
      });
    }
    const val = adjustCurrency(vAmount);
    dispatch(
      validateProfileAction({
        data: { ...val, dWalletAdd: pDetails?.wAddress },
        loader: true
      })
    );
  };

  useEffect(() => {
    if (isValid) {
      if (validateProfile.error === false) {
        toast.success(validateProfile.validateProfile.message, {
          toastId: "validateProfile1" + Date.now(),
          onClose: () => {
            getProfileVscore();
            profileInfo();
            setRdxBlnc();
            setIsValid(false);
            setVerifyModal(false);
            // window.location.reload()
          }
        });
      } else if (validateProfile.error !== null) {
        toast.error(validateProfile.error.message, {
          toastId: "validateProfile2" + Date.now(),
          onClose: () => {
            getProfileVscore();
            profileInfo();
            setRdxBlnc();
            setIsValid(false);
            // window.location.reload()
          }
        });
      }
    }
  }, [validateProfile.error, isValid]); // eslint-disable-line

  const getProfileVscore = () => {
    dispatch(
      getProfileVScoreAction({
        wAddress:
          pathname.split("/").length < 3
            ? myDecodedToken.ac
            : pathname.split("/").pop()
      })
    )
      .then((vScorePoint) => {
        const { vPointDetails } = vScorePoint?.data;
        setVScore(vPointDetails[0]?.totalVPoint);
        const Vpoints = vPointDetails[0]?.validator;
        setValidatorAdd(Vpoints);
      })
      .catch((err) => console.log(err, "vpoint error"));
  };

  useEffect(() => {
    getProfileVscore();
  }, []); // eslint-disable-line

  // const renderProducts = () => {
  //   return !!validatorAdd ? validatorAdd.map((element, i) => { (
  //   <div>
  //     {console.log("valueeeeeeeeee",i, element.ownerAdd )}
  //     <p>{i+1 + ". " + element.ownerAdd}  </p>
  //     <Button>Copy</Button>
  //   </div>
  //   )}):""}

  const editName = () => {
    if (!!pDetails && (pDetails.isEdited === 0 || pDetails.isEdited === 0)) {
      // return alert("Changing name now will result in zero vpoint")
      Swal.fire({
        title: "Warning",
        // text: MessageConst.confirmPaymentOfFiveXrp,
        html: `<p class="swalPara">Your validation score will be zero after updating name, Do you still want to proceed ?</P>`,
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes"
      }).then((result) => {
        if (result.isConfirmed) {
          setEditProfileName(true);
        } else {
          return;
        }
      });
    } else {
      setEditProfileName(true);
    }
  };

  const getDBannerImg = () => {
    if (!!pDetails) {
      if (pDetails?.dBanner?.startsWith("https://ipfs.io/")) {
        return replaceHost(pDetails?.dBanner);
      } else {
        return pDetails?.dBanner
          ? `${configData.LOCAL_API_URL + pDetails?.dBanner}`
          : NFT;
      }
    } else if (!!storeDBannerImg) {
      return storeDBannerImg;
    } else {
      return NFT;
    }
  };

  const arr = ["XRP 0.1", "XDX 100", "XSQUAD 0.001"];

  const registrationLocked =
    checkValidProfile() && isPaid === 0 && isPaid !== null;

  return (
    <React.Fragment>
      <Header
        setSearchKey={setSearchKey}
        setIsPaid={setIsPaid}
        isPaid={isPaid}
      />
      <div className={registrationLocked ? "position-relative" : undefined}>
        {registrationLocked && (
          <div
            className="position-absolute top-0 start-0 w-100 h-100"
            style={{
              zIndex: 1025,
              background: "rgba(15, 15, 20, 0.5)",
              cursor: "not-allowed",
              pointerEvents: "auto"
            }}
            aria-hidden
          />
        )}
        {searchKey && (
          <div className="gradientBg">
            <Container fluid={false} className="py-4 profileBox">
              <Row className="d-none d-md-block d-xl-block d-xxl-block">
                <Col lg={12}>
                  <div className="bannerimg_profile">
                    {/* <img src={NFT} alt=""/> */}
                    <CardImg
                      variant="top"
                      src={getDBannerImg()}
                      alt=""
                      className="cstm_bg_ad"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = NFT;
                      }}
                    ></CardImg>
                    {checkValidProfile() && (
                      <i
                        className="fa fa-pencil"
                        aria-hidden="true"
                        onClick={() => {
                          dismissQrIfOpen();
                          setDBannerDialog(true);
                          setStoreDBannerImg(null);
                          setCompletedCrop("");
                          setCrop("");
                          setImgSrc("");
                        }}
                      ></i>
                    )}
                  </div>
                </Col>
              </Row>
              <Row>
                <Col md={12} lg={4} className="text-center cardheight-dynmic">
                  <Card>
                    <div className="cstm_bg-cardadded">
                      <div className="img_pos-cstndd">
                        <CardImg
                          variant="top"
                          src={
                            !!storeBackImage
                              ? storeBackImage
                              : !!pDetails
                              ? pDetails?.pBanner?.startsWith(
                                  "https://ipfs.io/"
                                )
                                ? replaceHost(pDetails?.pBanner)
                                : pDetails?.pBanner
                                ? `${
                                    configData.LOCAL_API_URL + pDetails?.pBanner
                                  }`
                                : NFT2
                              : NFT2
                          }
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = NFT2;
                          }}
                          alt=""
                          className="cstm_bg_ad"
                        ></CardImg>
                        {checkValidProfile() && (
                          <i
                            className="fa fa-pencil"
                            aria-hidden="true"
                            onClick={() => {
                              dismissQrIfOpen();
                              setStoreBackImage(null);
                              setCompletedCrop("");
                              setCrop("");
                              setImgSrc("");
                              setBackDialog(true);
                            }}
                          ></i>
                        )}
                      </div>

                      <div className="editImg circle-img">
                        <CardImg
                          variant="top"
                          src={
                            !!storeImage
                              ? storeImage
                              : !!pDetails
                              ? pDetails?.pImage?.startsWith("https://ipfs.io/")
                                ? replaceHost(pDetails?.pImage)
                                : pDetails?.pImage
                                ? `${
                                    configData.LOCAL_API_URL + pDetails?.pImage
                                  }`
                                : NFT3
                              : NFT3
                          }
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = NFT3;
                          }}
                          alt=""
                        ></CardImg>
                        {checkValidProfile() && (
                          <i
                            className="fa fa-pencil"
                            aria-hidden="true"
                            onClick={() => {
                              dismissQrIfOpen();
                              setstoreImage(null);
                              setCompletedCrop("");
                              setCrop("");
                              setImgSrc("");
                              setDialog(true);
                            }}
                          ></i>
                        )}
                      </div>
                    </div>

                    <SocialSitesLink
                      socialLink={pDetails}
                      setshowdialog={(open) => {
                        if (open) dismissQrIfOpen();
                        setshowdialog(open);
                      }}
                      validateProf={checkValidProfile()}
                    />
                  </Card>
                </Col>
                <Col md={12} lg={8}>
                  <Card className="cstmProfileCardBox">
                    <div className="top-header changeheader-top">
                      <div className="radical_profileBox">
                        <CopyToClipboard
                          onCopy={() =>
                            toast.success("Link Copied", {
                              toastId: "copy" + Date.now()
                            })
                          }
                          text={profileShareUrl(
                            pathname.split("/").length === 3
                              ? pathname.split("/").pop()
                              : myDecodedToken?.ac
                          )}
                        >
                          <div className="radicalProfile share-icn">
                            <h4>
                              Fuzion-XIO Profile{" "}
                              <i
                                className="fa fa-share-alt"
                                aria-hidden="true"
                              ></i>
                            </h4>
                          </div>
                        </CopyToClipboard>
                        <div className="radicalProfile">
                          <h4>
                            Activated :{" "}
                            {!!pDetails?.createdAt
                              ? new Date(
                                  pDetails?.createdAt
                                ).toLocaleDateString("en-US", DATE_OPTIONS)
                              : "No"}
                          </h4>
                        </div>
                      </div>

                      <div className="newdivideradd">
                        {profileBatchColor(!!vScore && vScore ? vScore : 0)}
                        {/* <img src={tickbadge} alt=""/> */}
                        <span className="mail">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            height="30"
                            viewBox="0 96 960 960"
                            width="30"
                            fill="#000"
                            className="d-block "
                          >
                            <path d="M140 896q-24 0-42-18t-18-42V316q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H140Zm340-302L140 371v465h680V371L480 594Zm0-60 336-218H145l335 218ZM140 371v-55 520-465Z" />
                          </svg>
                        </span>
                        {isPaid === 5 && <img src={"/reg-bedge.png"} />}
                        {/* <Button
                        variant="primary"
                        type="submit"
                        onClick={handleSubmit}
                        disabled={pathname.split("/").length === 3 && pathname.split("/").pop() !== myDecodedToken?.ac ? true : false}
                      >
                        Submit
                      </Button> */}
                      </div>
                    </div>
                    <Form>
                      <Form.Group
                        className="mb-2 d-flex align-items-center profileInput inputfont12px"
                        controlId="wallet"
                      >
                        <Form.Label>Wallet :</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="rNbyFosH9MbETy6y1aKu"
                          value={
                            pathname.split("/").length < 3
                              ? !!pDetails && pDetails?.wAddress !== undefined
                                ? pDetails?.wAddress
                                : myDecodedToken?.ac
                                ? myDecodedToken?.ac
                                : pathname.split("/").pop()
                              : pathname.split("/").pop()
                          }
                          readOnly
                        />
                        <CopyToClipboard
                          onCopy={() =>
                            toast.success("Address Copied", {
                              toastId: "copy" + Date.now()
                            })
                          }
                          text={
                            pathname.split("/").length < 3
                              ? !!pDetails && pDetails?.wAddress !== undefined
                                ? pDetails?.wAddress
                                : myDecodedToken?.ac
                                ? myDecodedToken?.ac
                                : pathname.split("/").pop()
                              : pathname.split("/").pop()
                          }
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="d-block"
                            height="27"
                            width="27"
                            viewBox="0 96 960 960"
                          >
                            <path d="M652 640q25 0 44.5-19.5t19.5-45q0-25.5-19.5-44.5T652 512q-25 0-44.5 19T588 575.5q0 25.5 19.5 45T652 640ZM180 823v53-600 547Zm0 113q-23 0-41.5-18T120 876V276q0-23 18.5-41.5T180 216h600q24 0 42 18.5t18 41.5v134h-60V276H180v600h600V743h60v133q0 24-18 42t-42 18H180Zm358-173q-34 0-54-20t-20-53V463q0-34 20-53.5t54-19.5h270q34 0 54 19.5t20 53.5v227q0 33-20 53t-54 20H538Zm284-60V450H524v253h298Z" />
                          </svg>
                        </CopyToClipboard>
                      </Form.Group>

                      <Form.Group
                        className="mb-2 d-flex align-items-center profileInput inputfont12px"
                        controlId="name"
                      >
                        <Form.Label>Name :</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Name"
                          name="pName"
                          defaultValue={!!pName ? pName : pDetails?.pName}
                          onChange={handleName}
                          readOnly={editProfileName ? false : true}
                        />
                        {checkValidProfile() ? (
                          !editProfileName ? (
                            <i
                              className="fa fa-pencil cstmNameIcon"
                              aria-hidden="true"
                              onClick={editName}
                            ></i>
                          ) : (
                            <i
                              className="fa fa-save cstmNameIcon"
                              aria-hidden="true"
                              disabled={
                                pName === pDetails?.pName ? true : false
                              }
                              onClick={() => {
                                if (pName === pDetails?.pName) {
                                  toast.error(
                                    "Profile Name Should not be same as before!",
                                    { toastId: "checkpname" + Date.now() }
                                  );
                                  return;
                                } else if (!pName) {
                                  toast.error(
                                    "Profile Name Should not be empty!",
                                    {
                                      toastId: "checkpname" + Date.now()
                                    }
                                  );
                                  return;
                                } else {
                                  handleSubmit();
                                }
                              }}
                            />
                          )
                        ) : null}
                      </Form.Group>
                    </Form>
                    <div className="validArtist d-flex align-items-center mt-4">
                      <div className="tabBtnBox">
                        <Button onClick={openAddToken} className="tabButtonBox">
                          Add Token
                        </Button>
                        <Button
                          onClick={openVerifyModal}
                          className="tabButtonBox"
                        >
                          Validate
                        </Button>
                      </div>

                      <div className="validScore d-flex align-items-center mt-0">
                        <Form.Label className="w-50px">
                          {!!vScore && vScore ? vScore : 0}
                        </Form.Label>
                      </div>
                    </div>
                    {/* <div className="validScore d-flex align-items-center">
                    <ProgressBar now={now} label={`${now}%`} />
                  </div> */}
                    <div className="likeScore d-flex align-items-center cstmmarginTop">
                      {/* <Form.Label><i className="fa fa-heart" aria-hidden="true"></i></Form.Label>
                                        <p className="mb-0">10</p> */}
                      <div className="clrchange_box">
                        <p className="mb-0">XIO Balance: </p>
                        <p className="mb-0">
                          {!!rdxBalance && rdxBalance.rdxBalance}
                        </p>
                      </div>
                      <p className="mb-0">{!!rdxBalance && rdxBalance.level}</p>
                    </div>
                    {(pDetails?.tagline || tagline) && (
                      <p className="dpmf-muted mt-3 mb-1">
                        {tagline || pDetails?.tagline}
                      </p>
                    )}
                    {(pDetails?.location || location) && (
                      <p className="dpmf-muted mb-1">
                        {location || pDetails?.location}
                      </p>
                    )}
                    {(pDetails?.website || website) && (
                      <p className="mb-0">
                        <a
                          href={website || pDetails?.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {website || pDetails?.website}
                        </a>
                      </p>
                    )}
                    <div className="qr_codeimgwrp">
                      <img src={QrCodeImgTest} alt="QR Code" />
                    </div>
                  </Card>
                </Col>
              </Row>
              <Row>
                <Col>
                  <Card>
                    <Row>
                      <Col md className="cstmMrgnBTM">
                        <FloatingLabel
                          controlId="floatingTextarea2"
                          label="Fuzion-XIO Bio"
                        >
                          <Form.Control
                            as="textarea"
                            placeholder="Leave a comment here"
                            style={{
                              height: "150px",
                              border: "1px solid #3F51B5",
                              borderRadius: "10px"
                            }}
                            name="bio"
                            onChange={handleBio}
                            readOnly={eidtBio ? false : true}
                            defaultValue={bio ? bio : pDetails?.bio}
                          />
                          {checkValidProfile() ? (
                            !eidtBio ? (
                              <Button
                                className="editBio"
                                onClick={() => setEidtBio(!eidtBio)}
                              >
                                <i
                                  className="fa fa-pencil"
                                  aria-hidden="true"
                                ></i>
                              </Button>
                            ) : (
                              <Button
                                className="editBio"
                                onClick={() => handleSubmit()}
                              >
                                <i className="fa fa-save" aria-hidden="true" />
                              </Button>
                            )
                          ) : null}
                        </FloatingLabel>
                        {checkValidProfile() && (
                          <div className="mt-3">
                            <Form.Control
                              className="mb-2"
                              placeholder="Tagline"
                              value={tagline}
                              onChange={(e) => setTagline(e.target.value)}
                            />
                            <Form.Control
                              className="mb-2"
                              placeholder="Location"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                            />
                            <Form.Control
                              className="mb-2"
                              placeholder="Website"
                              value={website}
                              onChange={(e) => setWebsite(e.target.value)}
                            />
                          </div>
                        )}
                      </Col>
                      <Col md>
                        <FloatingLabel
                          controlId="floatingTextarea2"
                          label={
                            !!validatorAdd && validatorAdd.length
                              ? " "
                              : `Profiles who have validated this User`
                          }
                        >
                          <ContentEditable
                            className="content-editable"
                            html={
                              !!validatorAdd && validatorAdd.length
                                ? `<p class="head-cls">Profiles who have validated this User</p>
                          ${validatorAdd
                            .filter((obj, index) => {
                              return (
                                index ===
                                validatorAdd.findIndex(
                                  (o) => obj.ownerAdd === o.ownerAdd
                                )
                              );
                            })
                            .filter((vl) => !!vl.ownerAdd)
                            .map((vl, i) => {
                              return (
                                `<span class="sno-cls">${++i}. </span>` +
                                `
                              ${
                                allProfile?.find(
                                  (v) => v.wAddress === vl.ownerAdd
                                )?.pImage
                                  ? `<img src=${
                                      allProfile
                                        ?.find(
                                          (v) => v.wAddress === vl?.ownerAdd
                                        )
                                        ?.pImage?.startsWith("https://ipfs")
                                        ? replaceHost(
                                            allProfile?.find(
                                              (v) => v.wAddress === vl.ownerAdd
                                            )?.pImage
                                          )
                                        : configData.LOCAL_API_URL +
                                          allProfile?.find(
                                            (v) => v.wAddress === vl?.ownerAdd
                                          )?.pImage
                                    } class="img-circle-view img-profile" width="18" height="18" />`
                                  : `<img src=${DummyProfile} class="img-circle-view img-profile" width="18" height="18" />`
                              }&nbsp;&nbsp` +
                                (allProfile?.find(
                                  (v) => v.wAddress === vl.ownerAdd
                                )
                                  ? allProfile?.find(
                                      (v) => v.wAddress === vl.ownerAdd
                                    )?.pName
                                  : "") +
                                `&nbsp; - &nbsp; <a href="/Profile/${
                                  vl.ownerAdd
                                }">${
                                  isMobile
                                    ? vl?.ownerAdd?.substring(0, 10)
                                    : vl?.ownerAdd
                                }</a>`
                              );
                            })
                            .join("<br />")}`
                                : ""
                            }
                            disabled={true}
                            tagName="article"
                          />
                        </FloatingLabel>
                      </Col>
                    </Row>
                    <Row className="mt-3 pb-3">
                      <Col className="text-start collection">
                        <div className="collections-header mt-5">
                          <h3 className="dpmf-profile-nfts-title">NFTs</h3>
                        </div>
                        {!profileNfts ? (
                          <Row className="loader-class">
                            <div className="dot-loader">
                              <span />
                              <span />
                              <span />
                            </div>
                          </Row>
                        ) : profileNfts.length === 0 ? (
                          <p className="dpmf-muted">
                            No NFTs on this profile yet. Open an NFT and use
                            Add NFT to Profile.
                          </p>
                        ) : (
                          <Row className="ownNft prof-collect m-md-0 mt-20 collections-grid">
                            {profileNfts.map((item) => (
                              <Col
                                lg={3}
                                md={3}
                                sm={6}
                                xs={4}
                                key={item._id || item.NFTokenID}
                                className="mb-4 collections-grid-col"
                              >
                                <Link
                                  to={`/Nftdetail/${item._id}`}
                                  className="dpmf-card-link"
                                >
                                  <div className="carousel-item-wrapper collection-tile-card">
                                    <div className="onwfilea profile-nft">
                                      <Filetype
                                        fileType={item.contentType || item.fileType}
                                        image={
                                          item.image
                                            ? replaceHost(item.image)
                                            : item.previewImage
                                        }
                                        height={180}
                                      />
                                    </div>
                                    <p className="mb-0 mt-2">
                                      {item.name || "NFT"}
                                    </p>
                                    <small className="dpmf-muted">
                                      {item.source === "xrpl"
                                        ? "XRP Ledger"
                                        : item.pinned
                                        ? "Pinned"
                                        : "Found"}
                                    </small>
                                  </div>
                                </Link>
                              </Col>
                            ))}
                          </Row>
                        )}
                        <div className="collections-header mt-5">
                          <Button
                            variant="primary"
                            type="submit"
                            onClick={displayColllect}
                          >
                            Collections{" "}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="48"
                              viewBox="0 96 960 960"
                              width="48"
                            >
                              <path d="M220 816q-24 0-42-18t-18-42V236q0-24 18-42t42-18h245l60 60h335q24 0 42 18t18 42v460q0 24-18 42t-42 18H220Zm0-60h640V296H500l-60-60H220v520Zm590 180H100q-24 0-42-18t-18-42V296h60v580h710v60ZM334 645h412L614 469 504 615l-79-86-91 116ZM220 756V236v520Z" />
                            </svg>
                          </Button>
                          {showcollect &&
                            uniqueCollections.length > collectionsPerPage && (
                              <div className="collections-pagination-controls">
                                <Button
                                  className="collections-nav-icon"
                                  disabled={collectionsViewPage === 0}
                                  onClick={() =>
                                    setCollectionsViewPage((pageNumber) =>
                                      Math.max(pageNumber - 1, 0)
                                    )
                                  }
                                  aria-label="Previous collections"
                                >
                                  <i
                                    className="fa fa-chevron-left"
                                    aria-hidden="true"
                                  ></i>
                                </Button>
                                <Button
                                  className="collections-nav-icon"
                                  disabled={
                                    collectionsViewPage >=
                                    totalCollectionPages - 1
                                  }
                                  onClick={() =>
                                    setCollectionsViewPage((pageNumber) =>
                                      Math.min(
                                        pageNumber + 1,
                                        totalCollectionPages - 1
                                      )
                                    )
                                  }
                                  aria-label="Next collections"
                                >
                                  <i
                                    className="fa fa-chevron-right"
                                    aria-hidden="true"
                                  ></i>
                                </Button>
                              </div>
                            )}
                        </div>

                        {showcollect && (
                          <div className="nft-collections">
                            {!profileCollections ? (
                              <Row className="loader-class">
                                <div className="dot-loader">
                                  <span />
                                  <span />
                                  <span />
                                </div>
                              </Row>
                            ) : profileCollections.length === 0 ||
                              uniqueCollections.length === 0 ? (
                              <Row>
                                <p className="text-center">
                                  {MessageConst.NoDataFound}
                                </p>
                              </Row>
                            ) : (
                              <>
                                <Row className="ownNft prof-collect m-md-0 mt-20 collections-grid">
                                  {visibleCollections.map((post) => {
                                      const collectionTarget = {
                                        pathname: "/collections",
                                        search: `address=${walletToken}&name=${encodeUnicodeToBase64(
                                          post.collectionName
                                        )}`
                                      };
                                      const isInteractiveModel =
                                        isInteractive3DType(post.contentType);
                                      const isMobileModelActive =
                                        !isInteractiveModel ||
                                        !isMobile ||
                                        visibleCollectionModelIds
                                          .slice(0, mobileActiveModelCount)
                                          .includes(post._id);

                                      return (
                                        <Col
                                          lg={3}
                                          md={3}
                                          sm={6}
                                          xs={4}
                                          key={post._id}
                                          className="mb-4 collections-grid-col"
                                        >
                                          <div className="carousel-item-wrapper collection-tile-card">
                                            <Col>
                                              <div className="onwfilea profile-nft-collections">
                                                {checkValidProfile() && (
                                                  <Button
                                                    className="profile-cls"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleRemoveCollection(
                                                        post
                                                      );
                                                    }}
                                                  >
                                                    <i
                                                      className="fa fa-trash"
                                                      aria-hidden="true"
                                                    ></i>
                                                  </Button>
                                                )}

                                                {isInteractiveModel ? (
                                                  <div
                                                    className="onwfilea profile-nft collection-tile-link"
                                                    onMouseDown={(event) =>
                                                      handleModelPointerStart(
                                                        post._id,
                                                        event
                                                      )
                                                    }
                                                    onMouseMove={(event) =>
                                                      handleModelPointerMove(
                                                        post._id,
                                                        event
                                                      )
                                                    }
                                                    onMouseUp={() =>
                                                      handleModelPointerEnd(
                                                        post._id,
                                                        collectionTarget
                                                      )
                                                    }
                                                    onMouseLeave={() => {
                                                      delete modelInteractionRef
                                                        .current[post._id];
                                                    }}
                                                    onTouchStart={(event) =>
                                                      handleModelPointerStart(
                                                        post._id,
                                                        event
                                                      )
                                                    }
                                                    onTouchMove={(event) =>
                                                      handleModelPointerMove(
                                                        post._id,
                                                        event
                                                      )
                                                    }
                                                    onTouchEnd={() =>
                                                      handleModelPointerEnd(
                                                        post._id,
                                                        collectionTarget
                                                      )
                                                    }
                                                  >
                                                    <Filetype
                                                      fileType={post.contentType}
                                                      image={replaceHost(
                                                        post.image
                                                      )}
                                                      layout={layout}
                                                      isCarouselMobile={
                                                        isMobile &&
                                                        isInteractiveModel
                                                      }
                                                      isActiveSlide={
                                                        isMobileModelActive
                                                      }
                                                      onModelReady={() =>
                                                        handleMobileCollectionModelReady(
                                                          post._id
                                                        )
                                                      }
                                                      profileImg={null}
                                                    />
                                                  </div>
                                                ) : (
                                                  <Link
                                                    className="onwfilea profile-nft collection-tile-link"
                                                    to={collectionTarget}
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    <Filetype
                                                      fileType={post.contentType}
                                                      image={replaceHost(
                                                        post.image
                                                      )}
                                                      layout={layout}
                                                      isCarouselMobile={
                                                        isMobile &&
                                                        isInteractiveModel
                                                      }
                                                      isActiveSlide={
                                                        isMobileModelActive
                                                      }
                                                      onModelReady={() =>
                                                        handleMobileCollectionModelReady(
                                                          post._id
                                                        )
                                                      }
                                                      profileImg={null}
                                                    />
                                                  </Link>
                                                )}
                                              </div>
                                              <h5
                                                className="collection-heading"
                                                title={post.collectionName}
                                                onClick={() => {
                                                  if (isInteractiveModel) {
                                                    navigate(collectionTarget);
                                                  }
                                                }}
                                              >
                                                <span className="collection-heading-text">
                                                  {post.collectionName
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    post?.collectionName?.substring(
                                                      1
                                                    )}
                                                </span>
                                                {post.isPurchased === 1 && (
                                                  <img
                                                    alt=""
                                                    src={BUYERNFT}
                                                    className="buyer-img"
                                                  />
                                                )}
                                              </h5>
                                            </Col>
                                            {!!issuerNFT &&
                                              issuerNFT.length > 0 &&
                                              issuerNFT.find(
                                                (vl) =>
                                                  vl?.collection ===
                                                  post?.collectionName
                                              ) && (
                                                <Col className="profile-progress">
                                                  <ProgressBarComponent
                                                    totalOffers={issuerNFT}
                                                    collection={
                                                      post.collectionName
                                                    }
                                                    compact={isMobile}
                                                  />
                                                </Col>
                                              )}
                                          </div>
                                        </Col>
                                      );
                                    })}
                              </Row>
                              </>
                            )}
                          </div>
                        )}
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            </Container>

            <div className={`gradientBg ${layout ? "myNFT" : ""}`}>
              <Container className="container">
                <Row className="auth-wrapper ownNftSection m-0">
                  <Col xs={12} md={12}>
                    {!collections ? (
                      <Row className="loader-class">
                        <Spinners.MutatingDots
                          visible={true}
                          height="100"
                          width="100"
                          color="#f531e9"
                          secondaryColor="#f531e9"
                          radius="12.5"
                          wrapperStyle={{
                            justifyContent: "center"
                          }}
                        />
                      </Row>
                    ) : collections?.docs?.length === 0 ? (
                      <Row>
                        <p className="text-center">
                          {" "}
                          {MessageConst.NoDataFound}
                        </p>
                      </Row>
                    ) : (
                      <Row className="ownNft m-md-0">
                        {collections?.docs?.map((post) => (
                          <Col
                            lg={4}
                            md={6}
                            xs={layout ? 4 : 12}
                            key={post._id}
                            className={``}
                          >
                            <Card
                              className={`${post.status} ${
                                layout ? "p-md-3 " : "p-3"
                              } customShado mb-3 mb-lg-5 mb-md-5 bg-white rounded shadowcstm corner-ribbon profile-ribbon`}
                            >
                              <div className="top-left-view">
                                <img
                                  alt=""
                                  src={
                                    allProfile?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )?.pImage === null
                                      ? DummyProfile
                                      : allProfile
                                          ?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )
                                          ?.pImage?.startsWith("https://ipfs")
                                      ? replaceHost(
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )?.pImage
                                        )
                                      : `${
                                          configData.LOCAL_API_URL +
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )?.pImage
                                        }`
                                  }
                                  className="img-circle-view"
                                />
                                <p className="top-left-text">
                                  {token !== null ? (
                                    <Link
                                      to={"/Profile/" + post?.accountNumber}
                                    >
                                      {post?.accountNumber?.substring(0, 9)}{" "}
                                      *****{" "}
                                      {post?.accountNumber?.substring(
                                        post?.accountNumber?.length - 5
                                      )}
                                    </Link>
                                  ) : (
                                    `${post?.accountNumber?.substring(
                                      0,
                                      9
                                    )} *****
                               ${post?.accountNumber?.substring(
                                 post?.accountNumber?.length - 5
                               )}`
                                  )}
                                </p>
                              </div>

                              <div className="card-img-overlay-custome likeCount">
                                <div>
                                  <p className="d-flex align-items-center">
                                    <Like
                                      post={post?.likes_data}
                                      id={post?._nftid}
                                    />
                                  </p>
                                </div>
                              </div>
                              <Link
                                className="onwfilea profile-nft"
                                to={"../Nftdetail/" + post._nftid}
                                state={{
                                  isValid: post?.accountNumber === walletToken
                                }}
                              >
                                <div className="onwfilea profile-nft">
                                  <Filetype
                                    fileType={post.contentType}
                                    image={post.image}
                                    layout={layout}
                                    profileImg={
                                      getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post.NFTokenID
                                      )?.pImage
                                        ? getProfileDetails(
                                            allProfile,
                                            allMintedNfts,
                                            post.NFTokenID
                                          ).pImage.startsWith("https://ipfs")
                                          ? replaceHost(
                                              getProfileDetails(
                                                allProfile,
                                                allMintedNfts,
                                                post.NFTokenID
                                              )?.pImage
                                            )
                                          : getProfileDetails(
                                              allProfile,
                                              allMintedNfts,
                                              post.NFTokenID
                                            ).pImage.startsWith("uploads/")
                                          ? `${
                                              configData.LOCAL_API_URL +
                                              getProfileDetails(
                                                allProfile,
                                                allMintedNfts,
                                                post.NFTokenID
                                              )?.pImage
                                            }`
                                          : DummyProfile
                                        : DummyProfile
                                    }
                                  />
                                </div>
                              </Link>

                              <Card.Body>
                                <div className="body-card">
                                  <Card.Title className="cardNFTName">
                                    {post.name
                                      ? post?.name?.length > 40
                                        ? post?.name?.substring(0, 40) + "..."
                                        : post?.name
                                      : "NA"}
                                  </Card.Title>
                                  <p className="body-cart-para">
                                    {(() => {
                                      const IssuerToken = allMintedNfts?.find(
                                        (vl) => vl.NFTokenID === post.NFTokenID
                                      );
                                      if (IssuerToken?.Issuer !== undefined) {
                                        if (token !== null) {
                                          return (
                                            <Link
                                              to={
                                                "/Profile/" +
                                                IssuerToken?.Issuer
                                              }
                                            >
                                              {IssuerToken?.Issuer?.substring(
                                                0,
                                                9
                                              ) +
                                                " ***** " +
                                                IssuerToken?.Issuer?.substring(
                                                  IssuerToken?.Issuer?.length -
                                                    5
                                                )}
                                            </Link>
                                          );
                                        } else {
                                          return (
                                            IssuerToken?.Issuer?.substring(
                                              0,
                                              9
                                            ) +
                                            " ***** " +
                                            IssuerToken?.Issuer?.substring(
                                              IssuerToken?.Issuer?.length - 5
                                            )
                                          );
                                        }
                                      } else {
                                        return (
                                          <span className="issuer-cls">
                                            N/A
                                          </span>
                                        );
                                      }
                                    })()}
                                    <div className="profile-collection token-badge customTokenbadge">
                                      <img src={tokenbadge} alt="" />
                                    </div>
                                    <div className="profile-cls tick-badge customTickbadge">
                                      {profileBatchColor(post?.vscore)}
                                    </div>
                                  </p>
                                  <hr className="hr-cls" />
                                  <p className="cardNFTBYACount">
                                    {post.currency ? `${post.currency}` : "XRP"}
                                  </p>
                                  <p className="cardNFTBY">{post?.price}</p>
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                    <br />
                    {/* <Row className="mx-auto">
                    <Col md={12} xs={12} className="text-right">
                      {!!collections && collections.totalPages > 1 && (
                        <Pagination>
                          {collections?.hasPrevPage ? (
                            <Pagination.First onClick={() => handlePagination(1)} />
                          ) : (
                            <Pagination.First disabled />
                          )}
                          {collections?.prevPage !== null ? (
                            <Pagination.Prev
                              onClick={() => handlePagination(collections?.prevPage)}
                            />
                          ) : (
                            <Pagination.Prev disabled />
                          )}

                          {Array.from(Array(collections?.totalPages).keys()).map(
                            (i, index) => {
                              return (
                                <Pagination.Item
                                  key={index}
                                  className={page === i + 1 ? "active" : ""}
                                  onClick={() => handlePagination(i + 1)}
                                >
                                  {i + 1}
                                </Pagination.Item>
                              );
                            }
                          )}
                          {collections?.nextPage !== null ? (
                            <Pagination.Next
                              onClick={() => handlePagination(collections?.nextPage)}
                            />
                          ) : (
                            <Pagination.Next disabled />
                          )}
                          {collections?.totalPages === page ? (
                            <Pagination.Last disabled />
                          ) : (
                            <Pagination.Last
                              onClick={() => handlePagination(collections?.totalPages)}
                            />
                          )}
                        </Pagination>
                      )}
                    </Col>
                  </Row> */}
                  </Col>
                </Row>
              </Container>
            </div>

            <Modal
              show={dialog}
              onHide={handleClose}
              className="profileModal"
              backdrop="static"
            >
              <Modal.Body>
                <Avatar
                  width={"100%"}
                  height={300}
                  onClose={onClose}
                  onCrop={onCrop}
                />
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onClick={handleClose}>
                  Close
                </Button>
                &nbsp;&nbsp;
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsLoader(true);
                    saveImg();
                  }}
                >
                  {isLoader ? (
                    <BeatLoader sizeUnit="px" size={10} color="#FFF" loading />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal
              show={backDialog}
              onHide={handleClose1}
              className="profileModal"
              size={!!imgSrc ? "lg" : "md"}
              centered
              backdrop="static"
            >
              <Modal.Body>
                <Row className="crop-img-modal">
                  <Col
                    xs={!!imgSrc ? 12 : 12}
                    sm={!!imgSrc ? 12 : 12}
                    lg={!!imgSrc ? 6 : 12}
                    md={!!imgSrc ? 6 : 12}
                    className=""
                  >
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={onSelectFile}
                    />
                    <br />
                    {!!imgSrc && (
                      <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={aspect}
                        // minWidth={400}
                        minHeight={100}
                        // circularCrop
                      >
                        <img
                          ref={imgRef}
                          alt="Crop me"
                          src={imgSrc}
                          style={{
                            transform: `scale(${scale}) rotate(${rotate}deg)`
                          }}
                          onLoad={onImageLoad}
                          className="defautprofile"
                        />
                      </ReactCrop>
                    )}
                  </Col>
                  {!!imgSrc && (
                    <Col xs={12} sm={6} lg={6} md={12}>
                      {!!completedCrop && (
                        <>
                          <div>
                            <canvas
                              ref={previewCanvasRef}
                              className="defautprofilefull"
                            />
                          </div>
                        </>
                      )}
                    </Col>
                  )}
                  {/* <Avatar
                exportAsSquare
                width={"100%"}
                height={300}
                onClose={onClose}
                onCrop={onCrop}
              /> */}
                </Row>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onClick={handleClose1}>
                  Close
                </Button>
                &nbsp;&nbsp;
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsLoader(true);
                    saveBackImg();
                  }}
                >
                  {isLoader ? (
                    <BeatLoader sizeUnit="px" size={10} color="#FFF" loading />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal
              show={dBannerDialog}
              onHide={handleClose2}
              className="profileModal"
              size={!!imgSrc ? "xl" : "md"}
              centered
              backdrop="static"
            >
              <Modal.Body>
                <Row>
                  <Col
                    xs={!!imgSrc ? 6 : 12}
                    sm={!!imgSrc ? 6 : 12}
                    lg={!!imgSrc ? 5 : 12}
                    md={!!imgSrc ? 5 : 12}
                  >
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={onSelectFile}
                    />
                    <br />
                    {
                      !!imgSrc && (
                        <ReactCrop
                          crop={crop}
                          onChange={(_, percentCrop) => setCrop(percentCrop)}
                          onComplete={(c) => setCompletedCrop(c)}
                          aspect={aspect}
                          // minWidth={400}
                          minHeight={100}
                          // circularCrop
                        >
                          <img
                            ref={imgRef}
                            alt="Crop me"
                            src={imgSrc}
                            style={{
                              transform: `scale(${scale}) rotate(${rotate}deg)`
                            }}
                            onLoad={onImageLoad}
                            className="defautprofile"
                          />
                        </ReactCrop>
                      )
                      // : <img
                      //   alt="Crop me"
                      //   src={PROFILEDEFAULT}
                      //   className="defautprofile"
                      // />
                    }
                  </Col>
                  {!!imgSrc && (
                    <Col xs={6} sm={6} lg={7} md={7}>
                      {!!completedCrop && (
                        <>
                          <div>
                            <canvas
                              ref={previewCanvasRef}
                              className="defautprofilefull"
                            />
                          </div>
                        </>
                      )}
                    </Col>
                  )}
                </Row>
                {/*<Avatar
                exportAsSquare
                exportSize={1000}
                width={1110}
                height={410}
                onClose={onClose}
                onCrop={onCrop}
              />*/}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onClick={handleClose2}>
                  Close
                </Button>
                &nbsp;&nbsp;
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsLoader(true);
                    saveDBannerImg();
                  }}
                >
                  {isLoader ? (
                    <BeatLoader sizeUnit="px" size={10} color="#FFF" loading />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal
              show={showdialog}
              onHide={handleCloseTWo}
              className="social"
              backdrop="static"
            >
              <Modal.Header closeButton>Link Social Account</Modal.Header>
              <Modal.Body>
                <Form>
                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <i
                        className="fa-brands fa-x-twitter"
                        aria-hidden="true"
                      ></i>{" "}
                      <span>Twitter</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Twitter Link"
                      name="twitter"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.twitter
                          ? socialHandles?.twitter
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["twitter"] !== "undefined"
                            )?.twitter
                      }
                    />
                  </Form.Group>
                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <i
                        className="fa fa-linkedin-square"
                        aria-hidden="true"
                      ></i>{" "}
                      <span>Linkedin</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Linkedin Link"
                      name="linkedIn"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.linkedIn
                          ? socialHandles?.linkedIn
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["linkedIn"] !== "undefined"
                            )?.linkedIn
                      }
                    />
                  </Form.Group>
                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <i className="fa fa-youtube-play" aria-hidden="true"></i>{" "}
                      <span>Youtube</span>{" "}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Youtube Link"
                      name="youtube"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.youtube
                          ? socialHandles?.youtube
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["youtube"] !== "undefined"
                            )?.youtube
                      }
                    />
                  </Form.Group>
                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <i
                        className="fa fa-facebook-square"
                        aria-hidden="true"
                      ></i>{" "}
                      <span>Facebook</span>{" "}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Facebook Link"
                      name="facebook"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.facebook
                          ? socialHandles?.facebook
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["facebook"] !== "undefined"
                            )?.facebook
                      }
                    />
                  </Form.Group>
                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <i className="fa fa-telegram" aria-hidden="true"></i>{" "}
                      <span>Telegram</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Telegram Link"
                      name="telegram"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.telegram
                          ? socialHandles?.telegram
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["telegram"] !== "undefined"
                            )?.telegram
                      }
                    />
                  </Form.Group>
                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <img src={WEBSITEIMG} className="webcls" />{" "}
                      <span>Website</span>{" "}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Website Link"
                      name="website"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.website
                          ? socialHandles?.website
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["website"] !== "undefined"
                            )?.website
                      }
                    />
                  </Form.Group>

                  <Form.Group
                    className="mb-3 d-flex align-items-center justify-content-between"
                    controlId="formBasicEmail"
                  >
                    <Form.Label>
                      <i className="fab fa-discord" aria-hidden="true"></i>{" "}
                      <span>Discord</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Discord Link"
                      name="discord"
                      onChange={handleChangeSocial}
                      defaultValue={
                        !!socialHandles && socialHandles?.discord
                          ? socialHandles?.discord
                          : pDetails?.socialLinks?.find(
                              (vl) => vl["discord"] !== "undefined"
                            )?.discord
                      }
                    />
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onClick={saveSociallink}>
                  Save Changes
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal
              show={verifyModal}
              onHide={handleCloseVerify}
              className="nftDetailModal"
            >
              <Modal.Header closeButton>
                <Modal.Title>Validate Profile</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>Select any payment option to validate profile.</p>
                <Row className="modalRow m-0">
                  {(!!fourthCurr
                    ? [...arr, fourthCurr.currency + " " + fourthCurr.amount]
                    : arr
                  ).map((vl, i) => {
                    return (
                      <Form.Check
                        type="radio"
                        label={vl}
                        name={`validateCurrency-${i}`}
                        checked={vAmount === vl ? true : false}
                        value={vl}
                        onChange={(e) => {
                          setVAmount(e.target.value);
                        }}
                        key={i}
                      />
                    );
                  })}
                </Row>
                <br />
                <Row>
                  <Col xs={12} md={12} className="margin-top1">
                    <Button
                      variant="primary"
                      onClick={ValidProfile}
                      type="submit"
                      className="form-control margin-top1"
                    >
                      {validateProfile.isSubmit ? (
                        <BeatLoader
                          sizeUnit="px"
                          size={10}
                          color="#FFF"
                          loading
                        />
                      ) : (
                        "Validate Profile"
                      )}
                    </Button>
                  </Col>
                </Row>
              </Modal.Body>
            </Modal>

            <ShowQRModal
              title="Registration"
              bodyText="Scan with XAMAN to sign in and register your wallet for a FREE profile."
              onCancel={() => {
                setIsValid(false);
              }}
            />

            <Modal
              show={showAddTokenModal}
              onHide={closeAddTokenModal}
              className="nftDetailModal"
            >
              <Modal.Body>
                <Row>
                  <Col xs={12} md={12}>
                    <div className="img-center">
                      <h2 className="text-center">Anchor Assets</h2>
                      <h6>Add fourth payment token to validate your profile</h6>
                    </div>
                  </Col>
                </Row>
                <br />
                <Row>
                  <Col className="default-currencies">
                    <p>XRP 0.1</p>
                    <p>XDX 100</p>
                    <p>XSQUAD 0.001</p>
                  </Col>
                </Row>
                <br />
                <Row>
                  <Col xs={6} md={6}>
                    <Form.Select
                      onChange={handleCurrency}
                      name="Currency"
                      aria-label="Default select example"
                      id="currency-dropdown"
                    >
                      <option value="">
                        {!!tokenTicker && tokenTicker.length > 0
                          ? "Currency"
                          : "No Currency"}
                      </option>
                      {!!tokenTicker &&
                        tokenTicker.map((curr, index) => (
                          <option key={index} value={curr.curr}>
                            {curr.currency}
                          </option>
                        ))}
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={6}>
                    <input
                      type="number"
                      name="saleAmount"
                      value={addTokenAmount}
                      onChange={handleAddTokenAmount}
                      className="form-control"
                      placeholder="Enter Amount"
                    ></input>
                  </Col>
                </Row>

                <br />
                <Row>
                  <Col xs={12} md={12}>
                    <Button
                      variant="primary"
                      onClick={addToken}
                      type="submit"
                      className="form-control"
                    >
                      {createProfile.isSubmit ? (
                        <BeatLoader
                          sizeUnit="px"
                          size={10}
                          color="#FFF"
                          loading
                        />
                      ) : (
                        "Add Token"
                      )}
                    </Button>
                  </Col>
                </Row>
              </Modal.Body>
              <br />
            </Modal>
          </div>
        )}
        <Footer />
      </div>
    </React.Fragment>
  );
};
export default Profile;
