import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { decodeToken } from "react-jwt";
import Modal from "react-bootstrap/Modal";
import "react-multi-carousel/lib/styles.css";
import axios from "axios";
import { Buffer } from "buffer";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Header from "../common/header";
import Footer from "../common/footer";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import configData from "../../config.json";

import MessageConst from "../../const/message.json";
import { Category, MetaVerse } from "../../const/category.js";
import { create as ipfsHttpClient } from "ipfs-http-client";
import PreviewFiletype from "../common/PreviewFiletype";
import {
  FILE_ACCEPT,
  FILE_LABEL,
  describeFile,
  isAllowedFile,
  mimeFromFile
} from "../../const/filetypes";
import { findTicker, mergeTickers, optionLabel } from "../../helper/assets";
import { ensureWalletTrustlines } from "../../helper/trustlines";
import { ProgressBar, OverlayTrigger, Tooltip } from "react-bootstrap";
// import { create as ipfsHttpClient } from 'kubo-rpc-client';
import {
  convertBase64,
  convertToFile,
  isBase64DataURL
} from "../../helper/convertBase64.js";

import { useDispatch, useSelector } from "react-redux";

// actions
import {
  createPaymentForIPFS,
  getBalanceAction,
  getMintedOffersByIsser
} from "../../store/actions/wallet.js";
import { BeatLoader, ClipLoader, SyncLoader } from "react-spinners";
import RangeSlider from "react-bootstrap-range-slider";
import "react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css";
import GenerateFamilySeeds from "../common/GenerateFamilySeeds.js";
import PaymentQRModal from "./PaymentQRModel.js";
import PreparedFiles from "./PreparedFiles.js";

const projectId = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID;
const projectSecret = process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const projectIdAndSecret = `${projectId}:${projectSecret}`;
// const authorization = 'Basic ' + btoa(projectId + ':' + projectSecret);

const client = projectId
  ? ipfsHttpClient({
      host: configData.HOST_IPFS,
      port: configData.PORT_IPFS,
      protocol: configData.PROTOCOL_IPFS,
      headers: {
        authorization: `Basic ${Buffer.from(projectIdAndSecret).toString("base64")}`
      }
    })
  : {
      add: async () => {
        throw new Error(
          "Set VITE_INFURA_IPFS_PROJECT_ID and VITE_INFURA_IPFS_PROJECT_SECRET to upload files while minting."
        );
      }
    };

const MAX_COUNT = 1000;

const Createnft = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({ tokentaxon: "0" });
  const [urlArr, setUrlArr] = useState([]);
  const [file, setFile] = useState(null);
  const [base64Progress, setBase64Progress] = useState(0);
  const [fileLimit, setFileLimit] = useState(false); // eslint-disable-line
  const [totalFiles, setTotalFiles] = useState(0);
  const [isCopyLoader, setIsCopyLoader] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchKey, setSearchKey] = useState(true);
  const [showModel, setShowModel] = useState(false);
  const [formValues, setFormValues] = useState([
    { traitType: "", traitValue: "" }
  ]);
  const [oneByOneImageUrl, setOneByOneImageUrl] = useState(null);
  const [finalMetaDataArray, setFinalMetaDataArray] = useState([]);
  const [nameIndex, setNameIndex] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [initialize, setInitialize] = useState(false);
  const [loader, setLoader] = useState(true);
  const [isPayment, setIsPayment] = useState(false);
  const [isPaymentModal, setIsPaymentModal] = useState(false);
  const [bufferFiles, setBufferFiles] = useState([]);
  const [currencyToPay, setCurrencyToPay] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [isLoader, setIsLoader] = useState(false);
  const [isActive, setisActive] = useState(false);
  const [totalPercentage, setTotalPercentage] = useState(false);
  const [isCalled, setIsCalled] = useState(false);
  const [loaderForBase64, setLoaderForBase64] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [FBXtoGBL, setFBXtoGBL] = useState([]);
  const stagedServerPathsRef = useRef({});
  const [isMintOffer, setIsMintOffer] = useState(false);
  const [offerData, setOfferData] = useState({ currency: "", amount: "" });
  const [currencyList, setCurrencyList] = useState([]);
  const [catalogAssets, setCatalogAssets] = useState([]);
  const [onlyXrpFlag, setOnlyXrpFlag] = useState(false);
  const [DNFTMutableFlag, setDNFTMutableFlag] = useState(false);
  const [burnFlag, setBurnFlag] = useState(false);
  const [tranFlag, setTransFlag] = useState(true);
  const [royaltyPerc, setRoyaltyPerc] = useState(0);
  const [offerMintData, setOfferMintData] = useState(null);
  const [isIssuerKey, setIsIssuerKey] = useState(null);
  const [vanityAddress, setVanityAddress] = useState(null);
  const [isNotification, setIsNotification] = useState(false);

  // wallet token (JWT)
  const token = localStorage.getItem("jwtToken");
  const myDecodedToken = decodeToken(token);

  // states
  const { paymentInfo, error, qrModal } = useSelector(
    (state) => state.IPFSPaymentReducer
  );

  const { isConnect, currency: walletBalance } = useSelector(
    (state) => state.getBalanceReducer
  );

  const [{ mintedOffers }] = useSelector((state) => [
    state.walletActionReducer
  ]);

  const fetchMetadata = async (url) => {
    try {
      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json"
        }
      });
      const metaData = response.data;
      return metaData;
    } catch (error) {
      console.log(error, "check fetch metatdata");
      return null;
    }
  };

  const copyMetaToAll = async () => {
    setIsCopied(false);
    setIsCopyLoader(true);
    try {
      const firstObj = urlArr[0];
      const restObj = urlArr.slice(1);

      // Get metadata from first NFT
      const baseMeta = await fetchMetadata(firstObj.metaDataUrl);

      // Always force #1 for the first NFT
      const baseName = baseMeta.name.replace(/#\d+$/, "").trim();
      const startNum = 1;

      // Re-upload for each of the other NFTs
      const finalData = await Promise.all(
        restObj.map(async (nft, i) => {
          const newMeta = {
            ...baseMeta,
            name: `${baseName} #${startNum + i + 1}`, // continue from last inserted
            image: nft.url
          };

          // Upload to IPFS
          const created = await client.add(JSON.stringify(newMeta));
          const urlMetadata = `${configData.ipfs_p}${created.path}`;

          return {
            ...nft,
            metaDataUrl: urlMetadata
          };
        })
      );

      // keep first object + add updated rest
      setUrlArr([firstObj, ...finalData]);
      setIsCopyLoader(false);
    } catch (err) {
      console.error("Error in copyMetaToAll:", err);
      throw err;
    }
  };

  const tooltip = (
    <Tooltip id="tooltip">
      <strong>Add Metadata</strong>
    </Tooltip>
  );

  const flagHandler = () => {
    const arr = [];
    if (tranFlag) arr.push(8);
    if (burnFlag) arr.push(1);
    if (onlyXrpFlag) arr.push(2);
    if (DNFTMutableFlag) arr.push(16);
    arr.join(", ");
    return arr.reduce((a, b) => a + b, 0);
  };

  const handleHideMintOffer = () => {
    setIsMintOffer(!isMintOffer);
    setOfferMintData(null);
    setOnlyXrpFlag(false);
    setDNFTMutableFlag(false);
    setBurnFlag(false);
    setTransFlag(true);
    setRoyaltyPerc(0);
    setOfferData({ currency: "", amount: "" });
  };

  const resetPaymentFlow = () => {
    setIsNotification(false);
    setIsPaymentModal(false);
    setIsPayment(false);
    setIsCalled(false);
    setIsLoader(false);
    setisActive(false);
    setCurrencyToPay("");
    setTotalAmount("");
    setOnlyXrpFlag(false);
    setDNFTMutableFlag(false);
    setBurnFlag(false);
    setTransFlag(true);
    setRoyaltyPerc(0);
    setOfferData({ currency: "", amount: "" });
    setOfferMintData(null);
  };

  const handleMintOffer = () => {
    const { currency, amount } = offerData;
    if (!currency) {
      toast.warn(MessageConst.SELECT_CURRENCY);
      return;
    }

    if (!amount) {
      toast.warn(MessageConst.warningEnterAmount);
      return;
    }

    const selected = findTicker(currencyList, currency);
    const ticker = selected?.currency || currency.split(":")[0];
    const data = {
      currency: ticker,
      issuerAdd: ticker === "XRP" ? "" : selected?.issuer || "",
      amount,
      flag: flagHandler(),
      transferFee: royaltyPerc * 1000,
      collection: bufferFiles.length > 1 ? formData.collectionName : null
    };

    ensureWalletTrustlines(myDecodedToken?.ac, [
      { currency: ticker, issuer: data.issuerAdd }
    ]);
    setIsMintOffer(!isMintOffer);
    setOfferMintData(data);
    toast.success(MessageConst.ADD_MINT_OFFER, {
      toastId: "addMintOffer" + Date.now()
    });
    return;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: value.trim()
    }));
  };

  const getTokenTaxon = () => {
    const parsedTaxon = Number.parseInt(formData?.tokentaxon, 10);
    return Number.isNaN(parsedTaxon) || parsedTaxon < 0 ? 0 : parsedTaxon;
  };

  const handleMintOfferModal = () => {
    if (validation()) {
      setIsMintOffer(!isMintOffer);
    }
  };

  const handleOfferData = (e) => {
    const { name, value } = e.target;
    setOfferData((p) => ({
      ...p,
      [name]: value.trim()
    }));
  };

  function getMimeType(file) {
    return mimeFromFile(file);
  }

  function getFileType(file) {
    return describeFile(file).mime;
  }

  const handleFileEvent = (e) => {
    e.preventDefault();
    setIsLoader(true);
    const chosenFiles = Array.prototype.slice.call(e.target.files);
    setTotalFiles(chosenFiles.length);

    const checkFiles = chosenFiles.filter((files) => !isAllowedFile(files));

    if (checkFiles?.length > 0) {
      e.target.value = "";
      toast.warn(MessageConst.warningSelectProperFileFormat, {
        toastId: "createNft4dg" + Date.now(),
        onClose: () => {
          setLoaderForBase64(false);
          setIsLoader(false);
        }
      });
    } else {
      const filterWithType = chosenFiles.map((file) => {
        const mime = getMimeType(file);
        if (!file.type || file.type === "application/octet-stream") {
          return new File([file], file.name, { type: mime });
        }
        return file;
      });

      retrieveFile(filterWithType);
    }
  };

  // const retrieveFile = async (chosenFiles) => {
  //   const total = chosenFiles.length;
  //   let processed = 0;

  //   const uploaded = [];
  //   let limitExceed = false;
  //   chosenFiles.map((files) => {
  //     // eslint-disable-line
  //     if (chosenFiles.findIndex((f) => f.name === files.name) === -1) {
  //       toast.warn(MessageConst.SAME_NAME_FILE_ERROR, {
  //         toastId: "samename1" + Date.now(),
  //         onClose: () => {
  //           setIsLoader(false);
  //           setLoaderForBase64(false);
  //         }
  //       });
  //       return true;
  //     }
  //     if (chosenFiles.length === MAX_COUNT) setFileLimit(true);
  //     if (chosenFiles.length > MAX_COUNT) {
  //       toast.warn(MessageConst.MAX_FILE_UPLOAD_WARN, {
  //         toastId: "maxlimit" + Date.now(),
  //         onClose: () => {
  //           setIsLoader(false);
  //           setLoaderForBase64(false);
  //         }
  //       });
  //       setFileLimit(false);
  //       limitExceed = true;
  //       return true;
  //     }
  //     uploaded.push(files);
  //   }); // eslint-disable-line

  //   if (!limitExceed) {
  //     const filesData = uploaded.map((vl) => ({
  //       url: vl,
  //       ftype: getFileMeta(vl).fileType,
  //       ctype: getFileMeta(vl).contentType
  //     }));
  //     const fileToBase64 = filesData.map(async (vl, i) => {
  //       processed += 1;
  //       setBase64Progress((processed / total) * 100);
  //       return {
  //         ...vl,
  //         _id: ++i,
  //         url: await convertBase64(vl.url)
  //       };
  //     });
  //     try {
  //       await Promise.all(fileToBase64)
  //         .then((res) => {
  //           setBufferFiles(res);
  //         })
  //         .then(() => {
  //           setLoaderForBase64(false);
  //           setIsLoader(false);
  //         });
  //     } catch (error) {
  //     }
  //   }
  // };

  // const readBuffer = (values) => {
  //   const reader = new window.FileReader();
  //   return new Promise((resolve) => {
  //     reader.readAsArrayBuffer(values);
  //     reader.onloadend = () => {
  //       resolve(Buffer(reader.result));
  //     };
  //   });
  // };

  const retrieveFile = async (chosenFiles) => {
    const total = chosenFiles.length;
    let processed = 0;

    const uploaded = [];
    let limitExceed = false;
    const BATCH_SIZE = 3; // keep client memory steadier for large media/model uploads

    chosenFiles.forEach((file) => {
      if (chosenFiles.findIndex((f) => f.name === file.name) === -1) {
        toast.warn(MessageConst.SAME_NAME_FILE_ERROR, {
          toastId: "samename1" + Date.now(),
          onClose: () => {
            setIsLoader(false);
            setLoaderForBase64(false);
          }
        });
        return;
      }

      if (chosenFiles.length === MAX_COUNT) setFileLimit(true);
      if (chosenFiles.length > MAX_COUNT) {
        toast.warn(MessageConst.MAX_FILE_UPLOAD_WARN, {
          toastId: "maxlimit" + Date.now(),
          onClose: () => {
            setIsLoader(false);
            setLoaderForBase64(false);
          }
        });
        setFileLimit(false);
        limitExceed = true;
        return;
      }

      uploaded.push(file);
    });

    if (limitExceed) return;

    const filesData = uploaded.map((vl) => ({
      url: vl,
      ftype: getFileMeta(vl).fileType,
      ctype: getFileMeta(vl).contentType
    }));

    const results = [];

    for (let i = 0; i < filesData.length; i += BATCH_SIZE) {
      const batch = filesData.slice(i, i + BATCH_SIZE);

      // Convert this batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (vl, index) => {
          try {
            const base64 = await convertBase64(vl.url, vl.ftype);
            return {
              ...vl,
              _id: i + index + 1,
              url: base64
            };
          } catch (error) {
            console.error("Error converting:", vl.url.name, error);
            return null;
          }
        })
      );

      // Filter successful ones and update result
      const successful = batchResults.filter(Boolean);
      results.push(...successful);

      // Update progress after each batch
      processed += batch.length;
      const progress = ((processed / total) * 100).toFixed(1);
      setBase64Progress(progress);
    }

    stagedServerPathsRef.current = {};
    setBufferFiles(results);
    setLoaderForBase64(false);
    setIsLoader(false);
  };

  useEffect(() => {
    if (qrModal.visible) {
      setIsPaymentModal(false);
      setIsNotification(true);
      setTotalAmount("");
    }
  }, [qrModal]);

  useEffect(() => {
    const checkInfura = async () => {
      try {
        const { cid } = await client.add("ping");
      } catch (error) {
        console.error("❌ Infura IPFS error:", error.message);
      }
    };

    checkInfura();
  }, []);

  useEffect(() => {
    if (token) {
      let data = {
        token: token
      };
      dispatch(getBalanceAction({ data, loader: true }));
      dispatch(getMintedOffersByIsser(myDecodedToken.ac));
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (mintedOffers) {
      const { data } = mintedOffers;
      if (data?.ciphertext) {
        setIsIssuerKey(data.ciphertext);
      }
    }
  }, [mintedOffers]);

  useEffect(() => {
    const q = myDecodedToken?.ac
      ? `?address=${encodeURIComponent(myDecodedToken.ac)}`
      : "";
    fetch(`${configData.LOCAL_API_URL}assets/catalog${q}`)
      .then((res) => res.json())
      .then((body) => setCatalogAssets(body.data?.assets || []))
      .catch(() => setCatalogAssets([]));
  }, [myDecodedToken?.ac]);

  useEffect(() => {
    const walletRows = Array.isArray(walletBalance)
      ? walletBalance
      : walletBalance?.currency || [];
    setCurrencyList(mergeTickers(catalogAssets, walletRows));
  }, [walletBalance, catalogAssets]);

  useEffect(() => {
    if (showModel === false) {
      setisActive(false);
    }
  }, [showModel]);

  useEffect(() => {
    if (isPayment && totalPercentage) {
      if (file.length === urlArr.length) {
        setTimeout(() => {
          setIsPaymentModal(false);
          setIsLoader(false);
        }, 1000);
      }
    }
  }, [isPayment, file, urlArr, totalPercentage]);

  useEffect(() => {
    if (!!paymentInfo && isActive) {
      const { message } = paymentInfo;
      setIsPaymentModal(true);
      toast.success(message, {
        toastId: "paymentsuccess" + Date.now(),
        onClose: async () => {
          let updatedArr;
          if (FBXtoGBL.length > 0) {
            updatedArr = bufferFiles.map((item, idx) => {
              return {
                ...item,
                url: FBXtoGBL[idx] || item.url // only replace if value exists
              };
            });
          } else {
            updatedArr = bufferFiles;
          }

          const data = updatedArr.map(async (vl, idx) => {
            if (isBase64DataURL(vl.url)) {
              return await convertToFile(
                vl.url,
                updatedArr.length > 0 ? `image_${idx}` : `image`
              );
            } else if (vl.url instanceof File) {
              return new File(
                [vl.url],
                updatedArr.length > 0
                  ? `image_${idx}.${vl.url.name.split(".").pop()}`
                  : `image.${vl.url.name.split(".").pop()}`,
                {
                  type: vl.url.type
                }
              );
            } else {
              return vl.url;
            }
          });

          const fileData = await Promise.all(data);
          setFile(fileData);
          setIsCalled(true);
          // setIsLoader(true);
          setIsPayment(true);
        }
      });
    }
  }, [paymentInfo, isActive]);

  useEffect(() => {
    if (!!error && isActive) {
      const { message } = error;
      toast.error(message, {
        toastId: "paymenterror" + Date.now(),
        onClose: () => {
          setIsLoader(false);
          setisActive(false);
          setIsPaymentModal(false);
          setIsPayment(false);
          setIsCalled(false);
        }
      });
    }
  }, [error, isActive]);

  // console.log(paymentData, "paymentData");
  // const memoizedFunction = React.useCallback(
  // 	async (file) => {
  // 		if (file !== null) {
  // 			setUrlArr([]);
  // 			// try {
  // 				// let percentage = 0;
  // 				const finalFiles = await Promise.all(
  // 					Array.from(file<).map>(async (singlefile) => {
  // 						setInitialize(true)
  // 						// const key = await readBuffer(singlefile)
  // 						setInitialize(false)
  // 						setFileName(singlefile.name);
  // 						const result = await client.add(singlefile, {
  // 							pin: true,
  // 							progress: (progress) => setProgress(Math.floor((progress / singlefile.size) * 100))
  // 						});
  // 						// setTotalPercentage(Math.floor(((++percentage / file.length) * 100)));
  // 						const url = `${configData.ipfs_p}${result.path}`;
  // 						return { url, ftype: singlefile.type.split("/")[1], ctype: singlefile.type.split("/")[0] };
  // 					})
  // 				);
  // 				console.log(finalFiles, "finalFiles")
  // 				setUrlArr(finalFiles);
  // 				setProgress(0);
  // 				// setTotalPercentage(0);
  // 				setFileName(null);
  // 			// } catch (err) {
  // 			// 	console.log(err, "chunks")
  // 			// }
  // 		}
  // 	},
  // 	[file]
  // );

  // useEffect(() => {
  // 	memoizedFunction(file);
  // }, [memoizedFunction, file]);  // eslint-disable-line
  function getFileMeta(vl) {
    const meta = describeFile(vl);
    return { fileType: meta.ftype, contentType: meta.ctype };
  }

  // useEffect(() => {
  //   let isMounted = true;
  //   if (!!file && file.length > 0 && isCalled) {
  //     setIsLoader(true);
  //     setProgress(0); // Reset once at start
  //     const finalFiles = [];

  //     let fileIndex = 0; // consistent unique IDs

  //     const promises = file.map(async (file1) => {
  //       setFileName(file1.name);

  //       try {
  //         // Upload as raw file (no wrapping, no filename in path)
  //         const result = await client.add(file1, {
  //           chunker: file1.size > 1048576 ? "size-1048576" : undefined,
  //           wrapWithDirectory: false, // ensures CID is the file itself
  //           pin: true,
  //           progress: (prog) =>
  //             setProgress(Math.floor((prog / file1.size) * 100))
  //         });

  //         // CID-only link
  //         const url = `${configData.ipfs_p}${result.cid.toString()}`;
  //         const { fileType, contentType } = getFileMeta(file1);

  //         finalFiles.push({
  //           url,
  //           _id: ++fileIndex,
  //           ftype: fileType,
  //           ctype: contentType
  //         });
  //       } catch (error) {
  //         console.error("Error uploading file:", error);
  //       }
  //     });

  //     Promise.all(promises).then(() => {
  //       if (isMounted) {
  //         console.log("Uploaded files:", finalFiles);

  //         // Match with bufferFiles safely
  //         const finalData = bufferFiles.map((x) =>
  //           finalFiles.find((a2) => a2._id === x._id)
  //         );

  //         console.log("Final mapped data:", finalData);

  //         setUrlArr(finalData);
  //         setFileName(null);
  //         setIsLoader(false);
  //         setTotalPercentage(true);
  //         setIsCalled(false);
  //       }
  //     });
  //   }
  //   return () => {
  //     isMounted = false;
  //   };
  // }, [file, isCalled, bufferFiles]);

  useEffect(() => {
    let isMounted = true;

    const uploadFilesSequentially = async () => {
      if (!!file && file.length > 0 && isCalled) {
        setIsLoader(true);
        setProgress(0);

        const finalFiles = [];

        try {
          for (const [index, file1] of file.entries()) {
            if (!isMounted) break;
            setFileName(file1.name);

            let url;
            if (
              typeof file1 === "string" &&
              (/^https?:\/\//i.test(file1) || file1.startsWith("/api/") || file1.startsWith("uploads/"))
            ) {
              url = file1.startsWith("uploads/") ? `/api/${file1}` : file1;
            } else try {
              const result = await client.add(file1, {
                chunker: file1.size > 1048576 ? "size-1048576" : undefined,
                wrapWithDirectory: false,
                pin: true,
                progress: (prog) =>
                  setProgress(Math.floor((prog / file1.size) * 100))
              });
              url = `${configData.ipfs_p}${result.cid.toString()}`;
            } catch (ipfsError) {
              const body = new FormData();
              body.append("file", file1);
              const local = await axios.post(
                `${configData.LOCAL_API_URL}mint/upload`,
                body,
                { headers: { "Content-Type": "multipart/form-data" } }
              );
              if (!local.data?.url) throw ipfsError;
              url = local.data.url;
            }
            const { fileType, contentType } = getFileMeta(file1);

            finalFiles.push({
              url,
              _id: bufferFiles[index]?._id ?? index + 1, // consistent stable ID
              ftype: fileType,
              ctype: contentType
            });

            const stagedPath = stagedServerPathsRef.current[index];
            if (stagedPath) {
              delete stagedServerPathsRef.current[index];
            }
          }

          if (isMounted) {
            // Match uploaded data with bufferFiles safely
            const finalData = bufferFiles.map((x) =>
              finalFiles.find((a2) => a2._id === x._id)
            );

            setUrlArr(finalData);
            setFileName(null);
            setIsLoader(false);
            setTotalPercentage(true);
            setIsCalled(false);
          }
        } catch (error) {
          console.error("Error uploading files:", error);
          if (isMounted) {
            setIsLoader(false);
            setIsCalled(false);
          }
        }
      }
    };

    uploadFilesSequentially();

    return () => {
      isMounted = false;
    };
  }, [file, isCalled, bufferFiles]);

  let handleaddChange = (i, e) => {
    let newFormValues = [...formValues];
    newFormValues[i][e.target.name] = e.target.value.trimStart();
    setFormValues(newFormValues);
  };

  let addFormFields = () => {
    setFormValues([...formValues, { traitType: "", traitValue: "" }]);
  };

  let removeFormFields = (i) => {
    let newFormValues = [...formValues];
    newFormValues.splice(i, 1);
    setFormValues(newFormValues);
  };

  const handlePayment = () => {
    setisActive(true);
    if (currencyToPay === "") {
      return toast.error(MessageConst.WARN_CURRENCY_NOT_FOUND, {
        toastId: "currencyCheck" + Date.now(),
        onClick: () => setisActive(false)
      });
    }

    try {
      const data = {
        account: myDecodedToken.ac,
        amount: totalAmount.toString(),
        issuedToken: myDecodedToken.it,
        currency: currencyToPay
      };

      dispatch(createPaymentForIPFS({ data, loader: true }));
    } catch (error) {
      console.error("❌ Error creating payment:", error);
      // dispatch({ type: actionTypes.CREATE_PAYMENT_FAILURE, payload: { error: true, message: "Payment creation failed" } });
    }
  };

  let handleSubmit = async (event) => {
    event.preventDefault();
    // const checkEmpty = formValues.every(
    // 	(item) => item.traitType && item.traitValue
    // );
    // if (!checkEmpty) {
    // 	return toast.warn(MessageConst.WARN_METADATA, {
    // 		toastId: "metaCheck" + Date.now(),
    // 	});
    // }

    const obj = {
      name: nameIndex,
      type: formData.category,
      metaverse: formData.metaverse,
      tokentaxon: getTokenTaxon(),
      description: formData.description,
      externalurl: formData.externalurl,
      creator: myDecodedToken.ac,
      image: oneByOneImageUrl.split("_")[0],
      attributes: formValues
    };

    const metadata =
      urlArr?.length > 1
        ? { ...obj, collectionName: formData.collectionName }
        : obj;

    const created1 = await client.add(JSON.stringify(metadata));

    const urlMetadata = `${configData.ipfs_p}${created1.path}`;
    const filteredUrl = urlArr.map((v, i) => ({
      ...v,
      url: urlArr.length > 1 ? `${v.url}_${++i}` : `${v.url}_${null}`
    }));

    const allFilteredUrl = filteredUrl.map((vl) => {
      // console.log(vl.url, "urlArr112", oneByOneImageUrl);
      if (vl.url == oneByOneImageUrl) {
        return { ...vl, metaDataUrl: urlMetadata };
      } else {
        return vl;
      }
    });

    const finalUrlArr = allFilteredUrl.map((vll) => ({
      ...vll,
      url: vll.url.split("_")[0]
    }));

    setUrlArr(finalUrlArr);
    setFinalMetaDataArray([...finalMetaDataArray, urlMetadata]);
    setFormValues([{ traitType: "", traitValue: "" }]);
    setShowModel(false);
  };

  const validation = (fromPrepared = false) => {
    let decimalregex = /^\d{0,7}(\.\d{0,6})?$/;

    if (!fromPrepared && bufferFiles.length > 1 && !formData["collectionName"]) {
      toast.warn(MessageConst.warningEnterNftCollection, {
        toastId: "createNft10" + Date.now()
      });
      return;
    }

    if (!formData["name"]) {
      toast.warn(MessageConst.warningEnterNftName, {
        toastId: "createNft1" + Date.now()
      });
      return;
    }

    if (!formData["category"]) {
      toast.warn(MessageConst.SelectCategory, {
        toastId: "createNft4" + Date.now()
      });
      return;
    }

    if (!formData["price"]) {
      toast.warn(MessageConst.warningEnterPrice, {
        toastId: "createNft3" + Date.now()
      });
      return;
    }
    if (formData["price"] <= 0) {
      toast.warn(MessageConst.warningEnterPrice, {
        toastId: "createNft3" + Date.now()
      });
      return;
    }
    if (!decimalregex.test(formData["price"])) {
      toast.warn(MessageConst.XRP_WRONG_DECIMAL, {
        toastId: "wrongdecimal11" + Date.now()
      });
      return;
    }
    if (!formData["description"]) {
      toast.warn(MessageConst.warningNFTDiscription, {
        toastId: "createNft4" + Date.now()
      });
      return;
    }

    if (!formData["externalurl"]) {
      toast.warn(MessageConst.warningExternalurl, {
        toastId: "createNft777" + Date.now()
      });
      return;
    }

    return true;
  };

  const getMetadataWithUrls = async (ipfsImageUrls) => {
    const obj = {
      type: formData.category,
      metaverse: formData.metaverse,
      tokentaxon: getTokenTaxon(),
      description: formData.description,
      externalurl: formData.externalurl,
      creator: myDecodedToken.ac,
      attributes: formValues
    };
    // console.log(ipfsImageUrls.length, "check the lenght")
    if (ipfsImageUrls.length > 1) {
      const finalImages = ipfsImageUrls.map(async (vl, i) => {
        const metadata = {
          collectionName: formData.collectionName,
          name: formData.name + `#${i + 1}`,
          image: vl.url,
          ...obj
        };
        const created1 = await client.add(JSON.stringify(metadata));
        const urlMetadata = `${configData.ipfs_p}${created1.path}`;
        return { ...vl, metaDataUrl: urlMetadata };
      });
      // console.log(await Promise.all(finalImages), "finalimages")
      return await Promise.all(finalImages);
    } else {
      const metadata = {
        // collectionName: formData.collectionName,
        name: formData.name,
        image: ipfsImageUrls[0].url,
        ...obj
      };
      const created1 = await client.add(JSON.stringify(metadata));
      const urlMetadata = `${configData.ipfs_p}${created1.path}`;
      // console.log([{ ...ipfsImageUrls[0], metaDataUrl: urlMetadata }], "finalimages111");
      return [{ ...ipfsImageUrls[0], metaDataUrl: urlMetadata }];
    }
  };

  const handleCurrency = (e) => {
    const { value } = e.target;

    if (value) {
      const amount = parseFloat(value.split(" ")[1]);
      const total = amount * bufferFiles.length;

      setCurrencyToPay(value.split(" ")[0]);

      let formatted;
      if (Number.isInteger(total)) {
        formatted = total.toString(); // no decimal part
      } else {
        const parts = total.toString().split(".");
        if (parts[1] && parts[1].length > 6) {
          formatted = total.toFixed(6); // round if more than 6 decimals
        } else {
          formatted = total.toString(); // keep as is
        }
      }

      setTotalAmount(formatted);
    } else {
      setTotalAmount("");
      setCurrencyToPay("");
    }
  };

  const removeMintOffer = () => {
    toast.error(MessageConst.REMOVE_MINT_OFFER, {
      toastId: "removeMintOffer" + Date.now(),
      onClose: () => {
        setOfferMintData(null);
        setOnlyXrpFlag(false);
        setDNFTMutableFlag(false);
        setBurnFlag(false);
        setTransFlag(true);
        setRoyaltyPerc(0);
        setOfferData({ currency: "", amount: "" });
        setIsIssuerKey(null);
        setVanityAddress(null);
      }
    });
    return;
  };

  const createPayment = () => {
    try {
      // console.log("check the validation")
      if (validation()) {
        // console.log("check the validation done", bufferFiles.length)
        if (bufferFiles.length === 0) {
          // console.log("check the bufferFiles", bufferFiles.length)
          toast.warn(MessageConst.warningSelectFile, {
            toastId: "createNft2" + Date.now()
          });
          return;
        }
        // console.log("check the isPaymentModal", isPaymentModal)
        setIsPaymentModal(true);
      }
    } catch (e) {
      console.log(e, "error during executeion");
    }
  };

  const createNft = async (e) => {
    setIsLoader(true);
    e.preventDefault();
    // if (validation()) {
    // if (!file ?? file.length === 0) {
    // 	toast.warn(MessageConst.warningSelectFile, {
    // 		toastId: "createNft2" + Date.now(),
    // 	});
    // 	return;
    // }

    const arrImg = await new Promise(async (resolve) => {
      if (finalMetaDataArray.length === 0) {
        const ImgArray = await getMetadataWithUrls(urlArr);
        resolve(ImgArray);
      } else {
        resolve([]);
      }
    });

    try {
      const config = {
        headers: {
          Authorization: `Basic ${token}`
        }
      };
      const obj = {
        name: formData.name,
        category: formData.category,
        metaverse: formData.metaverse,
        tokentaxon: getTokenTaxon(),
        royaltyBps: Number(royaltyPerc || 0) * 100,
        royaltyRecipient: formData.royaltyRecipient || myDecodedToken?.ac,
        image: arrImg.length ? arrImg : urlArr,
        price: formData.price,
        description: formData.description,
        externalurl: formData.externalurl,
        status: "created",
        accountNumber: myDecodedToken?.ac,
        issuer: myDecodedToken?.ac,
        fileType: arrImg.length ? arrImg : urlArr,
        contentType: arrImg.length ? arrImg : urlArr
      };

      const data =
        urlArr.length > 1
          ? { ...obj, collectionName: formData.collectionName }
          : obj;

      let res = await axios.post(
        `${configData.LOCAL_API_URL}nft/createNft`,
        data,
        config
      );

      if (res.data.success) {
        const { message, Ids } = res.data;
        const mintOfferNFTs = Ids.map((id) => {
          return { nftid: id, ...offerMintData };
        });

        if (!!offerMintData) {
          await axios.post(
            `${configData.LOCAL_API_URL}mintoffer/create`,
            {
              offerData: mintOfferNFTs,
              seed: isIssuerKey,
              vanityAddress: vanityAddress
            },
            config
          );
        }

        toast.success(message, {
          toastId: "createNft5"
        });
        setTimeout(() => {
          setIsLoader(false);
          navigate("/MyNFT");
        }, 1000);
      }
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "createNft6" + Date.now()
      });
    }
    // }
  };

  const openModal = (imageUrl, i) => {
    if (validation(formData)) {
      if (i === 1) {
        setIsCopied(true);
      }
      setShowModel(true);
      setOneByOneImageUrl(`${imageUrl}_${i}`);
      const nameImg = i === null ? formData.name : formData.name + ` #${i}`;
      // console.log(`${imageUrl}_${i}`, "check the image url1111", nameImg);
      setNameIndex(nameImg);
    }
  };
  const handleCloseModel = () => setShowModel(false);

  return (
    <React.Fragment>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg createNewNFT">
          <>
            <Container className="content-container">
              <Row className="auth-wrapper App align-items-center padding-top-bottom-50">
                <Col xs={12} md={10}>
                  <Form className="auth-inner">
                    <h3>Create NFT</h3>
                    <p>
                      <sup className="text-danger">*</sup> Fill in the Required
                      Fields
                    </p>
                    <PreparedFiles
                      account={myDecodedToken?.ac}
                      token={token}
                      formData={formData}
                      validate={validation}
                      onApply={(items, pack) => {
                        setUrlArr(items);
                        setBufferFiles(items);
                        setTotalPercentage(true);
                        setFormData((prev) => ({
                          ...prev,
                          collectionName:
                            prev.collectionName || pack?.collectionName || "",
                          name: prev.name || pack?.name || "",
                          description:
                            prev.description || pack?.description || ""
                        }));
                      }}
                      onCreated={() => {
                        setIsLoader(false);
                        navigate("/MyNFT");
                      }}
                    />
                    <Form.Group className="mb-3" controlId="formBasicFirstName">
                      <Form.Label>Collection</Form.Label>
                      <Form.Control
                        type="text"
                        name="collectionName"
                        onChange={handleChange}
                        placeholder="Enter Collection"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicFirstName">
                      <Form.Label>
                        Name <sup className="text-danger">*</sup>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        onChange={handleChange}
                        placeholder="Enter Name"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicFirstName">
                      <Form.Label>
                        Category <sup className="text-danger">*</sup>
                      </Form.Label>
                      <Form.Select
                        onChange={handleChange}
                        name="category"
                        aria-label="Default select example"
                      >
                        <option value="">Select Category</option>
                        {Category.map((cat, index) => (
                          <option key={index} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicFirstName">
                      <Form.Label>MetaVerse Configuration</Form.Label>
                      <Form.Select
                        onChange={handleChange}
                        name="metaverse"
                        aria-label="Default select example"
                      >
                        <option value="">Select MetaVerse</option>
                        {MetaVerse.map((val, index) => (
                          <option key={index} value={val}>
                            {val}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicLastName">
                      <Form.Label>Token Taxon</Form.Label>
                      <Form.Control
                        type="number"
                        name="tokentaxon"
                        onChange={handleChange}
                        value={formData.tokentaxon ?? "0"}
                        placeholder="0"
                        min={0}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicLastName">
                      <Form.Label>
                        Floor Price (XRP) <sup className="text-danger">*</sup>
                      </Form.Label>
                      <Form.Control
                        type="number"
                        name="price"
                        onChange={handleChange}
                        placeholder="Enter Price"
                        min={0}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail">
                      <Form.Label>
                        Description <sup className="text-danger">*</sup>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={5}
                        name="description"
                        onChange={handleChange}
                        placeholder="Enter Description"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail">
                      <Form.Label>
                        External Url <sup className="text-danger">*</sup>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="externalurl"
                        onChange={handleChange}
                        placeholder="Enter Any URL of your choice"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicFirstName">
                      {/* <Form.Label>{initialize ? "loading..." : !!fileName ? `File Name : ${fileName}` : urlArr.length > 0 ? (urlArr.length === 1 ? `${urlArr.length} file uploaded successfully !` : `${urlArr.length} files uploaded successfully!`) : "Image"}</Form.Label> */}
                      {/* {progress > 0 && (urlArr.length > 0 && bufferFiles.length !== urlArr.length) && (
												<ProgressBar
													now={progress}
													animated
													label={`${progress} bytes uploaded`}
												/>
											)} */}
                      <Form.Control
                        type="file"
                        name="file"
                        accept={FILE_ACCEPT}
                        onChange={handleFileEvent}
                        multiple
                        disabled={urlArr.length > 0 ? true : false}
                      />
                      <Form.Label style={{ paddingTop: "5px" }}>
                        Select {FILE_LABEL}. <sup className="text-danger">*</sup>
                      </Form.Label>
                    </Form.Group>
                    {urlArr.length > 0 && <p>Add Metadata</p>}
                    {loaderForBase64 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column", // 👈 stack vertically
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "0.75rem", // space between elements
                          paddingBottom: "1rem"
                        }}
                      >
                        <ClipLoader size={40} color="#c000ff" loading={true} />

                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.9rem",
                            color: "#555",
                            fontWeight: 500
                          }}
                        >
                          Processing {Math.round(base64Progress)}% (
                          {Math.round((base64Progress / 100) * totalFiles)} /{" "}
                          {totalFiles})
                        </p>

                        <progress
                          value={base64Progress}
                          max="100"
                          style={{
                            width: "16rem",
                            height: "8px",
                            borderRadius: "6px",
                            appearance: "none",
                            accentColor: "#007bff"
                          }}
                        />
                      </div>
                    ) : (
                      // <div
                      //   style={{
                      //     display: "flex",
                      //     justifyContent: "center",
                      //     alignItems: "center",
                      //     height: "10vh",
                      //     marginTop: "-26px",
                      //     paddingBlock: "1rem"
                      //   }}
                      // >
                      // <ClockLoader
                      //   size={50}
                      //   color="#c000ff"
                      //   boarderWidth={5}
                      //   loading={true}
                      // />
                      //  </div>
                      <div className="selfCrousel">
                        {(urlArr.length > 0 ? urlArr : bufferFiles).length >
                        0 ? (
                          (urlArr.length > 0
                            ? bufferFiles.map((x) =>
                                urlArr.find((a2) => a2._id === x._id)
                              )
                            : bufferFiles
                          )?.map((val, i) => {
                            return (
                              <div
                                className="img_preview_file"
                                key={val._id || i}
                              >
                                {urlArr.length > 0 &&
                                  (val.metaDataUrl ? (
                                    <>
                                      <i
                                        aria-hidden="true"
                                        className="fa fa-minus faPlusIcan"
                                      />
                                      {urlArr.length > 1 &&
                                      i === 0 &&
                                      isCopied ? (
                                        <OverlayTrigger
                                          placement="top"
                                          overlay={
                                            <Tooltip id="tooltip-disabled">
                                              Copy same metadata for all the
                                              other NFTs and once you filled it.
                                              You can't change.
                                            </Tooltip>
                                          }
                                        >
                                          <i
                                            aria-hidden="true"
                                            className="fas fa-copy faCopyIcon"
                                            onClick={copyMetaToAll}
                                          />
                                        </OverlayTrigger>
                                      ) : isCopyLoader && i === 0 ? (
                                        <span className="copyLoader">
                                          <SyncLoader size={7} />
                                        </span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <div className="metadata-cls">
                                      <OverlayTrigger
                                        placement="right"
                                        overlay={tooltip}
                                      >
                                        <i
                                          aria-hidden="true"
                                          className="fa fa-plus faPlusIcan"
                                          onClick={() => {
                                            openModal(
                                              val.url,
                                              urlArr.length > 1 ? i + 1 : null
                                            );
                                          }}
                                        />
                                      </OverlayTrigger>
                                      <span className="circle-icon">
                                        {val._id}
                                      </span>
                                    </div>
                                  ))}
                                <PreviewFiletype
                                  fileType={val.ctype}
                                  image={val.url}
                                  modelSlotIndex={i}
                                  // setLoader={setLoader}
                                  setFBXtoGBL={setFBXtoGBL}
                                  onRegisterStagedPath={(serverPath) => {
                                    stagedServerPathsRef.current[i] =
                                      serverPath;
                                  }}
                                />

                                <br />
                              </div>
                            );
                          })
                        ) : (
                          <p></p>
                        )}
                      </div>
                    )}
                    <Button
                      variant="primary"
                      onClick={isPayment ? createNft : createPayment}
                      type={isPayment ? "submit" : "button"}
                      className="form-control create-an-nft"
                      disabled={isLoader}
                    >
                      {isLoader || isCopyLoader ? (
                        <BeatLoader
                          sizeUnit="px"
                          size={10}
                          color="#FFF"
                          loading
                        />
                      ) : isPayment ? (
                        "Launch"
                      ) : (
                        "Create"
                      )}
                    </Button>
                    {bufferFiles.length > 0 &&
                      (offerMintData !== null ? (
                        <Button
                          variant="danger"
                          onClick={removeMintOffer}
                          type="button"
                          className="form-control mint-offer-remove mt-1"
                        >
                          Remove Offer
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handleMintOfferModal()}
                          type="button"
                          className="form-control mint-offer"
                        >
                          Offer to Mint
                        </Button>
                      ))}
                  </Form>
                </Col>
              </Row>

              {/* mint offer modal */}
              <Modal
                show={isMintOffer}
                onHide={handleHideMintOffer}
                backdrop="static"
                size={isIssuerKey ? "" : "lg"}
              >
                <Modal.Header closeButton>
                  <h4 className="modal-title text-center">Create an Offer</h4>
                </Modal.Header>
                {!isIssuerKey ? (
                  <Modal.Body>
                    <GenerateFamilySeeds
                      setIsIssuerKey={setIsIssuerKey}
                      setVanityAddress={setVanityAddress}
                    />
                  </Modal.Body>
                ) : (
                  <Modal.Body>
                    <Row className="mt-2">
                      <Col xs={6} md={6}>
                        <Form.Select
                          onChange={handleOfferData}
                          name="currency"
                          aria-label="Default select example"
                          id="currency-dropdown"
                        >
                          <option value="">Select Currency</option>
                          {(currencyList || []).map((item, index) => {
                            return (
                              <option value={item.curr || item.currency} key={item.curr || index}>
                                {optionLabel(item)}
                              </option>
                            );
                          })}
                        </Form.Select>
                      </Col>
                      <Col xs={6} md={6}>
                        <input
                          type="text"
                          name="amount"
                          value={offerData.amount}
                          onChange={handleOfferData}
                          className="form-control"
                          placeholder="Amount"
                        ></input>
                      </Col>
                    </Row>
                    <Row className="modalRow mt-4">
                      <Col>
                        <Form.Check
                          type="switch"
                          label="Transferable"
                          checked={tranFlag}
                          onChange={(e) => {
                            setTransFlag(e.target.checked);
                          }}
                        />
                      </Col>
                      <Col>
                        <Form.Check
                          type="switch"
                          label="Burnable"
                          checked={burnFlag}
                          onChange={(e) => {
                            setBurnFlag(e.target.checked);
                          }}
                        />
                      </Col>
                      <Col>
                        <Form.Check
                          type="switch"
                          label="OnlyXRP"
                          checked={onlyXrpFlag}
                          onChange={(e) => {
                            setOnlyXrpFlag(e.target.checked);
                          }}
                        />
                      </Col>
                      <Col style={{ paddingTop: 12 }}>
                        <Form.Check
                          type="switch"
                          label="DNFT-Mutable"
                          checked={DNFTMutableFlag}
                          onChange={(e) => {
                            setDNFTMutableFlag(e.target.checked);
                          }}
                        />
                      </Col>
                    </Row>
                    <Row className="mt-4">
                      <Col xs={12} md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label>Royalty recipient</Form.Label>
                          <Form.Control
                            type="text"
                            name="royaltyRecipient"
                            onChange={handleChange}
                            placeholder="r-address (defaults to your wallet)"
                          />
                        </Form.Group>
                        <label className="label-uppercase">
                          ADD ROYALTY 0-50%
                        </label>
                        <RangeSlider
                          value={royaltyPerc}
                          onChange={(e) => setRoyaltyPerc(e.target.value)}
                          min={0}
                          max={50}
                          tooltipLabel={(currentValue) => `${currentValue}%`}
                          tooltip="on"
                          className=""
                        />
                      </Col>
                    </Row>
                    <Row className="mt-3">
                      <Col xs={12} md={12} className="margin-top1">
                        <Button
                          variant="primary"
                          onClick={handleMintOffer}
                          type="submit"
                          className="form-control margin-top1"
                        >
                          {isConnect ? (
                            <BeatLoader
                              sizeUnit="px"
                              size={10}
                              color="#FFF"
                              loading
                            />
                          ) : (
                            "Mint Offer"
                          )}
                        </Button>
                      </Col>
                    </Row>
                  </Modal.Body>
                )}
              </Modal>

              {/* modal start*/}
              <Modal
                show={showModel}
                onHide={handleCloseModel}
                backdrop="static"
              >
                <Modal.Header closeButton>
                  <h6>Add Properties for metadata.</h6>
                </Modal.Header>
                <Modal.Body>
                  <Row className={formValues.length > 10 ? "scroll-bar" : ""}>
                    <Col xs={12} md={12}>
                      {formValues.map((element, index) => (
                        <div className="form-inline" key={index}>
                          <Row>
                            <Col xs={5} md={5}>
                              <label htmlFor="Trait Type">Trait Type</label>
                              <input
                                type="text"
                                name="traitType"
                                value={element.traitType || ""}
                                className="form-control"
                                onChange={(e) => handleaddChange(index, e)}
                              />
                            </Col>
                            <Col xs={5} md={5}>
                              <label htmlFor="Value">Value</label>
                              <input
                                type="text"
                                name="traitValue"
                                value={element.traitValue || ""}
                                className="form-control"
                                onChange={(e) => handleaddChange(index, e)}
                              />
                            </Col>
                            <Col xs={2} md={2}>
                              {index ? (
                                <>
                                  <br />
                                  <i
                                    className="fa fa-close"
                                    onClick={() => removeFormFields(index)}
                                    style={{ fontSize: "36px" }}
                                    aria-hidden="true"
                                  ></i>
                                </>
                              ) : null}
                            </Col>
                          </Row>
                        </div>
                      ))}
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <Button
                        variant="primary"
                        type="submit"
                        className=""
                        onClick={() => addFormFields()}
                      >
                        Add More
                      </Button>
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12} className="margin-top1">
                      <Button
                        variant="primary"
                        type="submit"
                        className="form-control margin-top1"
                        onClick={(e) => handleSubmit(e)}
                      >
                        Save
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>
              {/* modal end */}

              {isNotification && (
                <PaymentQRModal
                  setIsPaymentModal={setIsPaymentModal}
                  setIsNotification={setIsNotification}
                  setisActive={setisActive}
                  qrModal={qrModal}
                  onCancel={resetPaymentFlow}
                />
              )}
              <Modal
                show={isPaymentModal}
                onHide={() => {
                  setIsPaymentModal(false);
                  setTotalAmount("");
                  setCurrencyToPay("");
                }}
                className="nftDetailModal"
                backdrop={isActive ? "static" : "false"}
              >
                <Modal.Body>
                  <Row>
                    <Col xs={12} md={12}>
                      <div className="img-center">
                        <h3 className="text-center">Create Payment</h3>
                        <h6>Choose Currency to Process IPFS Payment.</h6>
                        {isPayment && progress > 0 && (
                          <>
                            <Form.Label>
                              {initialize
                                ? "loading..."
                                : !!fileName
                                ? `File Name : ${fileName}`
                                : urlArr.length > 0
                                ? urlArr.length === 1
                                  ? `${urlArr.length} file uploaded successfully !`
                                  : `${urlArr.length} files uploaded successfully!`
                                : "Image"}
                            </Form.Label>
                            <ProgressBar
                              now={progress}
                              animated
                              label={`${progress}% completed`}
                            />
                            <p>
                              Please wait while your files are being uploaded in
                              an IPFS...
                            </p>
                          </>
                        )}
                      </div>
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
                        <option value="">Select Currency</option>
                        <option value={`XRP ${0.1}`}>XRP</option>
                        <option value={`XDX ${100}`}>XDX</option>
                        <option
                          value={`5853515541440000000000000000000000000000 ${0.01}`}
                        >
                          XSQUAD
                        </option>
                      </Form.Select>
                    </Col>
                    <Col xs={6} md={6}>
                      <input
                        type="text"
                        name="saleAmount"
                        value={totalAmount}
                        // onChange={handleAddTokenAmount}
                        className="form-control"
                        placeholder="Amount"
                        disabled
                      ></input>
                    </Col>
                  </Row>
                  <br />
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <Button
                        variant="primary"
                        onClick={handlePayment}
                        type="button"
                        className="form-control"
                        disabled={isActive ? true : false}
                      >
                        {isActive ? (
                          <BeatLoader
                            sizeUnit="px"
                            size={10}
                            color="#FFF"
                            loading
                          />
                        ) : (
                          "Payment"
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>
            </Container>
          </>
        </div>
      )}
      <Footer />
    </React.Fragment>
  );
};

export default Createnft;
