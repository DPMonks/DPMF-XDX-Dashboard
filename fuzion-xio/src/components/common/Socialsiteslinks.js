import React from "react";
import website from "../../assets/website.svg";
import Button from "react-bootstrap/Button";


const SocialSitesLink = ({ socialLink, setshowdialog, validateProf }) => {
    
  const getActualLink = link => (link.startsWith("https") ? link : `https://${link}`);

   return (
        <>
         <div className="socialbox">
                    <ul>           
                      {!!socialLink && socialLink.socialLinks.length > 0 ? 
                       (socialLink.socialLinks.map((vl, i) => {
                           return (
                          <React.Fragment key={i}>
                            <li>
                                <a
                                  href={vl.twitter ? getActualLink(vl.twitter) : undefined}
                                  rel="noopener noreferrer"
                                  target={vl.twitter ? "_blank" : undefined}
                                >
                                  <i className="fa-brands fa-x-twitter" aria-hidden="true"></i>
                                </a>                              
                            </li>
                            <li>                              
                                <a
                                  href={vl.linkedIn ? getActualLink(vl.linkedIn) : undefined}
                                  target={vl.linkedIn ? "_blank" : undefined}
                                  rel="noopener noreferrer"
                                >
                                  <i
                                    className="fa-brands fa-linkedin"
                                    aria-hidden="true"
                                  ></i>
                                </a>
                            </li>
                            <li>
                              <a
                                href={vl.youtube ? getActualLink(vl.youtube) : undefined}
                                target={vl.youtube ? "_blank" : undefined}
                                rel="noopener noreferrer"
                              >
                                <i
                                  className="fa fa-youtube-play"
                                  aria-hidden="true"
                                ></i>
                              </a>
                            </li>
                            <li>
                              <a
                                href={vl.facebook ? getActualLink(vl.facebook) : undefined}
                                target={vl.facebook ? "_blank" : undefined}
                                rel="noopener noreferrer"
                              >
                                <i
                                  className="fa fa-facebook"
                                  aria-hidden="true"
                                ></i>
                              </a>
                            </li>
                            <li>
                              <a
                                href={vl.telegram ? getActualLink(vl.telegram) : undefined}
                                target={vl.telegram ? "_blank" : undefined}
                                rel="noopener noreferrer"
                              >
                                <i
                                  className="fa fa-telegram"
                                  aria-hidden="true"
                                ></i>
                              </a>
                            </li>
                            <li>
                              <a
                                href={vl.website ? getActualLink(vl.website) : undefined}
                                target={vl.website ? "_blank" : undefined}
                                rel="noopener noreferrer"
                              >
                                <img src={website} alt="" width={35} />
                              </a>
                            </li>
                            <li>
                              <a
                                href={vl.discord ? getActualLink(vl.discord) : undefined}
                                target={vl.discord ? "_blank" : undefined}
                                rel="noopener noreferrer"
                              >
                                <i
                                  className="fab fa-discord"
                                  aria-hidden="true"
                                ></i>
                              </a>
                            </li>
                          </React.Fragment>)}))
                          : (
                            <>
                            <li>
                                <i className="fa-brands fa-x-twitter"></i>
                            </li>
                            <li>
                                <i
                                  className="fa fa-linkedin"
                                  aria-hidden="true"
                                ></i>
                            </li>
                            <li>
                                <i
                                  className="fa fa-youtube-play"
                                  aria-hidden="true"
                                ></i>
                            </li>
                            <li>
                              
                                <i
                                  className="fa fa-facebook"
                                  aria-hidden="true"
                                ></i>
                            </li>
                            <li>
                              
                                <i
                                  className="fa fa-telegram"
                                  aria-hidden="true"
                                ></i>
                            </li>
                            <li>
                                <img src={website} alt="" width={35} />
                            </li>
                            <li>
                                <i
                                  className="fab fa-discord"
                                  aria-hidden="true"
                                ></i>
                            </li>
                          </>
                        )}
                    </ul>
                    {validateProf && <Button
                      className="editSocial"
                      onClick={() => setshowdialog(true)}
                    >
                      <i className="fa fa-pencil" aria-hidden="true"></i>
                    </Button>}
                  </div>
        </>
    )
}

export default SocialSitesLink;
