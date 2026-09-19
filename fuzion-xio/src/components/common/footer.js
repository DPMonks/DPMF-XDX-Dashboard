import React, { useState } from "react";
import Container from "react-bootstrap/Container";
// import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { Image, Modal } from "react-bootstrap";

// import Aboutpdf from "../../assets/Fuzion-XIO-About.pdf";
// import BecomePartnerPdf from "../../assets/Become_a_partner.pdf";
import DPMF from "../../assets/dpmflogonew.jpg"

function Footer() {
  const [ppModal, setPpModal] = useState(false);
  const [tcModal, setTcModal] = useState(false);
  const [discModal, setDiscModal] = useState(false);

  const openPpModal = () => {
    setPpModal(true);
  };
  const openTcModal = () => {
    setTcModal(true);
  };
  const openDiscModal = () => {
    setDiscModal(true);
  };
  const handleClose = () => setPpModal(false);
  const handleCloseTWo = () => setTcModal(false);
  const handleCloseDisc = () => setDiscModal(false);
  return (
    <React.Fragment>
      <Container className="pt-3">
        <Row>
          <Col md={5} xs={12}>
            <Row>
              {/* <Col md={12} xs={12}>
                <Form>
                  <h4 className="footer-heading">Subscribe to updates</h4>
                  <Form.Group className="mb-3" controlId="formBasicEmail">
                    <Form.Control
                      type="email"
                      name="email"
                      placeholder="Enter email"
                      className="footer-subheading width-50-fixed"
                    />
                  </Form.Group>
                </Form>
              </Col> */}
              {/* <br />
              <br />
              <br />
              <br />
              <br />
              <br /> */}
              <Col md={12} xs={12}>
                <Image src={DPMF} className="img-full" />
                <h4 className="footer-heading top-footer">Follow us</h4>
                <div className="iocs-main">
                  <a
                    href="https://x.com/fuzion_xio"
                    target="_blank"
                    className="ftr-icons"
                    rel="noreferrer"
                  >
                    <i className="fa fa-x-twitter" aria-hidden="true"></i>
                  </a>
                  <a
                    href="https://www.linkedin.com/company/d-p-monks-finance/"
                    target="_blank"
                    className="ftr-icons"
                    rel="noreferrer"
                  >
                    <i className="fa fa-linkedin" aria-hidden="true"></i>
                  </a>
                  <a
                    href="https://youtube.com/channel/UCUk4qiEgcY-tHk--r3duMNQ"
                    target="_blank"
                    className="ftr-icons"
                    rel="noreferrer"
                  >
                    <i className="fa fa-youtube-play" aria-hidden="true"></i>
                  </a>
                  <a
                    href="https://www.facebook.com/DPMonksFinance.XRPL"
                    target="_blank"
                    className="ftr-icons"
                    rel="noreferrer"
                  >
                    <i className="fa fa-facebook" aria-hidden="true"></i>
                  </a>
                  <a
                    href="https://instagram.com/d.p.monks.finance?r=nametag"
                    target="_blank"
                    className="ftr-icons"
                    rel="noreferrer"
                  >
                    <i className="fa fa-instagram" aria-hidden="true"></i>
                  </a>
                  <a
                    href="https://t.me/DPMonksFinance"
                    target="_blank"
                    className="ftr-icons"
                    rel="noreferrer"
                  >
                    <i className="fa fa-telegram" aria-hidden="true"></i>
                  </a>
                  {/* <a href="#" target="_blank" className="ftr-icons">
                      <i className="fa fa-tiktok" aria-hidden="true"></i>
                    </a> */}
                </div>
              </Col>
            </Row>
          </Col>
          <Col md={7} xs={12}>
            <Row>
              <Col md={6} xs={12}>
                <br />
                <h4 className="footer-heading d-none d-md-none d-lg-none d-xl-block">Follow us</h4>
                <p className="footer-subheading d-flex">
                  <a href="/#">Explore</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
                <p className="footer-subheading">
                  <a
                    href="https://discord.com/invite/WvpCacfyKC"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Help Center
                  </a>
                </p>
                <p className="footer-subheading d-flex">
                  <a href="/#">Platform Status</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
                <p className="footer-subheading">
                  {// eslint-disable-next-line
                    <a style={{ color: "#5d5d5b" }} onClick={openDiscModal}>
                    Disclaimer
                  </a>}
                </p>
                <p className="footer-subheading">
                  <a
                    href="https://www.dpmonksfinance.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Company Website
                  </a>
                </p>
                <p className="footer-subheading">
                  <a
                    href="https://www.ava-metamart.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    AVA-MetaMart
                  </a>
                </p>
                <p className="footer-subheading">
                  <a
                    href="https://www.spatial.io/s/XION-Gallery-64b8c3ba9d0c210a1e8c4d28"
                    target="_blank"
                    rel="noreferrer"
                  >
                    XION Gallery
                  </a>
                </p>
                {/* <p className="footer-subheading">
                  <a href={BecomePartnerPdf} target="_blank" rel="noreferrer">
                    Become a Partner
                  </a>
                </p> */}
                {/* <p className="footer-subheading">
                  <a href={Aboutpdf} target="_blank" rel="noreferrer">
                    About Us
                  </a>
                </p> */}
              </Col>
              <Col md={6} xs={12}>
              <br />
                <h4 className="footer-heading">Community</h4>
                <p className="footer-subheading d-flex">
                  <a href="/profiles">Profiles</a>
                  {/* <span className="comInSoon">Coming Soon</span> */}
                </p>
                <p className="footer-subheading d-flex">
                  <a href="/#">Favorites</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
                <p className="footer-subheading d-flex">
                  <a href="/#">Watchlist</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
                <p className="footer-subheading d-flex">
                  <a href="/#">My Collections</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
                <p className="footer-subheading d-flex">
                  <a href="/#">Rankings</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
                <p className="footer-subheading d-flex">
                  <a href="/#">Activity</a>{" "}
                  <span className="comInSoon">Coming Soon</span>
                </p>
              </Col>
              {/* <Col md={4} xs={12}>
                <h4 className="footer-heading">Region</h4>
              </Col> */}
            </Row>
          </Col>
        </Row>
        <Row>
          <br />
          <br />
        </Row>
      </Container>
      <Container fluid>
        <Row>
          <Col md={6} xs={6} className="text-left">
            <div className="footer-heading d-flex">
              <p onClick={openPpModal}>Privacy Policy</p>
              <p onClick={openTcModal}>Terms & Condition</p>
            </div>
          </Col>
        </Row>
      </Container>
      <Modal
        show={ppModal}
        onHide={handleClose}
        backdrop="static"
        className="privacyModal"
      >
        <Modal.Header closeButton className="px-md-5 px-lg-5 px-xl-5">
          <Modal.Title>
            <strong className="text-info">Privacy Policy</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-md-5 px-lg-5 px-xl-5">
          <div>
            <p>Last Updated: January 7th, 2023</p>
            <p>FUZION-XIO.io (Fuzion-XIO.io,” “we”, “us”, or “our”) is committed
              to protecting any information that we collect. This Privacy Policy
              lays down the practices towards Personal Data in how we as a
              Website/Application collect, use of data, share within the
              Fuzion-XIO.io platform, mobile app, and other associated software
              provided and in connection with any of our services, as described
              in our Terms of Service (TOS){" "}
            </p>
            <p>
              The reference to “NFT” in this Policy means a Non-Fungible Token
              or any similar digital item used on the blockchain
            </p>
            <p>
              This Policy is a legally binding agreement between you (“User”,
              “you” or “your”) and Daniel Monks of D P Monks (“Fuzion-XIO.io”,
              “we”, “us” or “our”). If you are entering into this agreement on
              behalf of a business or other legal entity, you represent that you
              have the authority to bind such entity to this agreement, in which
              case the terms “User”, “you” or “your” shall refer to such entity.
              If you do not have such authority, or if you do not agree with the
              terms of this agreement, you must not accept this agreement and
              may not access and use the Website/Application. By accessing and
              using the Website/Application, you acknowledge that you have read,
              understood, and agree to be bound by the terms of this Policy.
              This Policy does not apply to the practices of companies that we
              do not own or control, or to individuals that we do not employ or
              manage.
            </p>
            <p>
              You can access and use the Website/Application without informing
              us who you are or revealing any information by which someone could
              identify you as a specific, identifiable individual. If, however,
              you wish to use some of the features offered on the
              Website/Application, you may be asked to provide certain Personal
              Information (for example, your name and e-mail address)
            </p>
            <p>
              Some of the information we collect is directly from you via the
              Website and Services. However, we may also collect Personal
              Information about you from other sources such as public databases
              and our joint marketing partners.
            </p>
            <p>
              You can choose not to provide us with your Personal Information,
              but then you may not be able to take advantage of some of the
              features on the Website. Users who are uncertain about what
              information is mandatory are welcome to contact us.
            </p>
            <h5>
              <b> Age Requirement.</b>
            </h5>
            <p>
              You must be at least 18 years of age to use the
              Website/Application. By using the Website/Application and by
              agreeing to this policy that you are above 18 years of age.
            </p>
            <h5>
              <b>Types Of Data.</b>
            </h5>
            <p>
              Personal Data – allows an individual to be identified
              individually, by name, email address, or as other non-public
              information about you that is linked.
            </p>
            <p>
              Anonymous Data which includes aggregated and de-identified data,
              which is not associated or linked to your Personal Data; Anonymous
              Data does not, by itself, permit the identification of individual
              persons.
            </p>
            <p>
              We collect Personal Data and Anonymous Data as described below.
            </p>
            <div className="ps-5">
              <p>
                The information you Provide to us whilst you use our
                Website/Application, update your personal profile, or in the
                process of contacting us. We may collect Personal Data from you,
                such as email address, first and last name, username or
                username, your blockchain address; and other information you
                provide.{" "}
              </p>
              <p>
                The service we provide allows you to store preferences on how
                your content is displayed, notification settings, and
                favourites.
              </p>
              <p>
                We may also collect Personal Data at other points in our Service
                where you voluntarily provide it or where we state that Personal
                Data is being collected.
              </p>
            </div>
            <h5>
              <b>Information Collected ViaTechnology</b>
            </h5>
            <div className="ps-5">
              <p>
                Information is collected through navigation and whilst
                interacting with our Website/Application. To provide our Service
                and make it more useful to you, we (or a third-party service
                provider) collect information from you, including, but not
                limited to, your browser type, operating system, Internet
                Protocol (“IP”) address, mobile device ID, blockchain address,
                wallet type, and date/time stamps. Log Files. As is true of most
                websites and applications, we gather certain information
                automatically and store it in log files. This information
                includes IP addresses, browser type, Internet service provider
                (“ISP”), referring/exit pages, operating system, date/time
                stamps, and clickstream data.
              </p>
            </div>
            ]
            <p>
              Information Collected from Third-Party Companies. On occasion we
              will receive Personal and/or Anonymous Data about you from other
              partners that will provide products or services for use and theses
              products and services can be linked from our Website/Application.
              An example of this can be described when third-party wallet
              providers provide us with your blockchain address. This will also,
              contain other information you choose to share within these
              wallets. We may add this to the data collected from or about the
              Website/Application.
            </p>
            <p>
              Public Information Observed from Blockchains. Collection of data
              that is publicly visible and/or accessible on blockchains. This
              may include blockchain addresses and information regarding
              purchases, sales, or transfers of NFTs, which may then be
              associated with other data you have provided to us.
            </p>
            <p>
              Personal Data Usage. The process of your Personal Data in the
              running of the Website/Application. The use of your Personal Data
              in the facilitation, creation and in securing your account
            </p>
            <h5>
              <b>Identification As A User On The Website/Application</b>
            </h5>
            <div className="ps-5">
              <p>
                Provide you as a user on the website/application a service,
                enable you to view, explore, and create NFTs using our tools
                and, in your time and discretion with the ability to connect
                directly, and mint, trade, purchase, sell, or transfer NFTs on
                public blockchains.
              </p>
              <p>
                investigate and address conduct that may violate our Terms of
                Service; detect, prevent, and address fraud, violations of our
                terms or policies, and/or other harmful or unlawful activity.{" "}
              </p>
              <p>
                Respond to your inquiries related to employment opportunities or
                other requests; comply with applicable laws, cooperate with
                investigations by law enforcement or other authorities of
                suspected violations of law, and/or to pursue or defend against
                legal threats and/or claims; and act in any other way we may
                describe when you provide the Personal Data
              </p>
            </div>
            <h5>
              <b>Disclosure Of Your Personal Data.</b>
            </h5>
            <p>
              We will only disclose any of your Personal Data as stated below
              and anywhere within this Policy.{" "}
            </p>
            <p>
              Third Party Service Providers may share your Personal Data with
              third party service providers.
            </p>
            <p>
              Partners that are affiliated may share some or all your Personal
              Data with any subsidiaries, joint ventures, or other companies
              under our common control (“Affiliates”), in which case we will
              require our Affiliates to comply with this Policy.
            </p>
            <p>
              Legal Rights. Regardless of any choices you make regarding your
              Personal Data (as described below), Fuzion-XIO.io may disclose
              Personal Data if it believes in good faith that such disclosure is
              necessary.
            </p>
            <div className="ps-5">
              <p>in connection with any legal investigation</p>
              <p>to comply with relevant laws</p>
              <p>
                to protect or defend the rights or property of Fuzion-XIO.io its
                users of the Website/Application{" "}
              </p>
              <p>
                to investigate or assist in preventing any violation or
                potential violation of the law, this Privacy Policy, or our
                Terms of Service.
              </p>
            </div>
            <h5>
              <b>Other Disclosures. </b>
            </h5>
            <p>
              We may also disclose your Personal Data to use for a purpose in
              which it is provided or any other purpose in which consent has
              been given by the individual.{" "}
            </p>
            <h5>
              <b>Third-Party Websites/Applications. </b>
            </h5>
            <p>
              The Website/Application may contain links to another website or
              applications. Whilst participating in this activity you will
              logout of the Website/Application and proceed to another site,
              that will collect Personal Data. There is no control over, and we
              cannot be responsible for these third-party websites.
            </p>
            <p>
              Please be aware that the terms of this Privacy Policy do not apply
              to these thirdparty websites/applications.
            </p>
            <h5>
              <b>Third-Party Wallets.</b>
            </h5>
            <p>
              In the processing of using our Website/Application the user must
              use a third-party wallet. This allows you to fully to engage in
              all transactions on the public blockchains.{" "}
            </p>
            <h5>
              <b>Data Access And Control. </b>
            </h5>
            <p>
              At any time, you can view, access, edit, or delete your Personal
              Data from our Website/Application within your personal blockchain
              wallet. All rights are protected under the UK General Data
              Protection Regulations (“GDPR”) and under respective European Law.
            </p>
            <div className="ps-5">
              <p>Request access and obtain a copy of your personal data.</p>
              <p>Request it to be rectified or deleted.</p>
              <p>
                Restrict the processing of your personal data or object to it
                being used.
              </p>
              <p>You have the right to withdraw your consent at any time.</p>
            </div>
            <p>
              If you wish to exercise your rights under the GDPR, or any other
              data protection or privacy laws, please contact us at
              Info@DPMonksFinance.com.
            </p>
            <div className="ps-5">
              <p>specify your request</p>
              <p>reference the applicable law.</p>
              <p>Identify yourself, and ask for any other information</p>
              <p>
                We will consider and act upon any above request in accordance
                with applicable law.
              </p>
              <p>
                We will not discriminate against you for exercising any of these
                rights.
              </p>
            </div>
            <p>
              We cannot edit or delete any information that is stored on a
              blockchain. The information stored on the blockchain will include
              purchases, sales, and transfers related to your blockchain address
              and NFTs held at that address.
            </p>
            <p>
              Data Retention. We may retain your Personal Data whilst you use
              the Website/Application. We may continue to retain your Personal
              Data to comply with our legal obligations, to resolve disputes,
              prevent fraud and abuse, enforce our Terms or other agreements,
              and/or protect our legitimate interests. Where your Personal Data
              is no longer required for these purposes, we will delete it
            </p>
            <h5>
              <b>Data Protection.</b>
            </h5>
            <p>
              Security of information, administrative, and technological
              safeguards must be of the highest standard to ensure the integrity
              and security of information collected through our
              Website/Application. Although, no security is impenetrable and
              therefore, we cannot guarantee the security of our
              Website/Application. Any breach of us being compromised we will
              take all measures to fully investigate in accordance with
              applicable laws and regulations. We will notify those individuals
              whose information may have been compromised. All of us are
              responsible for the security of our digital wallet and implore all
              to take steps in ensuring our wallets are fully secure. If you
              discover an issue related to your wallet, please contact your
              wallet provider.
            </p>
            <h5>
              <b>Acceptance Of This Policy</b>
            </h5>
            <p>
              You acknowledge that you have read the Privacy Policy and agree to
              all the terms and conditions of the policy. In gaining access to
              the Application/Website you are bound by this policy, and if you
              do not agree; to the terms and conditions you are not authorised
              by the policy holder to use the Website/Application.
            </p>
            <h5>
              <b>Changes To This Privacy Policy.</b>
            </h5>
            <p>
              This Privacy Policy will be assessed and updated annually. We will
              not notify you of any changes or amendments to our Privacy Policy.
              The date the Privacy Policy was last revised is identified at the
              beginning of this Privacy Policy. You are responsible for
              periodically visiting our Service and this Privacy Policy to check
              for any changes.
            </p>
            <h5>
              <b>Reporting Violations. </b>
            </h5>
            <p>
              If you have any questions or concerns or complaints about our
              Privacy Policy or our data collection or processing practices, or
              if you want to report any security violations to us, please
              contact us at Info@DPMonksFinance.com.
            </p>
          </div>
        </Modal.Body>
      </Modal>
      <Modal
        show={tcModal}
        onHide={handleCloseTWo}
        backdrop="static"
        className="privacyModal"
      >
        <Modal.Header closeButton className="px-md-5 px-lg-5 px-xl-5">
          <Modal.Title>
            <strong className="text-info">Terms & Condition</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-md-5 px-lg-5 px-xl-5">
          <div>
            <p>
              The terms and conditions (“Compliance”) are the general terms and
              conditions whilst using the Fuzion-XIO.io for use of our
              Website/Application (“Website” or “Application”) and any of its
              related products. By being compliant the terms and conditions are
              binding between you (“User”, “you” or “your”) and Fuzion-XIO, “we”,
              “us” or “our”).{" "}
            </p>
            <p>
              This Policy is a legally binding agreement between you (“User”,
              “you” or “your”) and Daniel Monks of D P Monks (“Fuzion-XIO.io”,
              “we”, “us” or “our”). If you are entering into this agreement on
              behalf of a business or other legal entity, you represent that you
              have the authority to bind such entity to this agreement, in which
              case the terms “User”, “you” or “your” shall refer to such entity.
              If you do not have such authority, or if you do not agree with the
              terms of this agreement, you must not accept this agreement and
              may not access and use the Website/Application. By accessing and
              using the Website/Application, you acknowledge that you have read,
              understood, and agree to be bound by the terms of this Policy.
              This Policy does not apply to the practices of companies that we
              do not own or control, or to individuals that we do not employ or
              manage.
            </p>
            <h5>
              <b>Age Requirement</b>
            </h5>
            <p>
              You must be at least 18 years of age to use the
              Website/Application. By using the Website/Application and by
              agreeing to this policy you are above 18 years of age.
            </p>
            <h6>About You</h6>
            <span>
              To use the Website/Application or receive services from
              Fuzion-XIO.io Payments, you need to:
            </span>
            <br />
            <ul>
              <li>
                <span>be at least 18 years old </span>
              </li>
            </ul>
            <h5>
              <b>Billing And Payments</b>
            </h5>
            <p>
              You must pay all fees or charges to your account in accordance
              with the fees, charges, and momentary terms in effect as fee or
              charge is payable. Sensitive and private data exchange happens
              over an SSL secured communication channel and is encrypted and
              protected. The Website/Application are compliant to create as
              secure of an environment as possible for Users. Scans for malware
              are performed on a regular basis for additional security and
              protection.
            </p>
            <p>
              We reserve the right to change the Website/Application pricing at
              any time.
            </p>
            <h5>
              <b>Accuracy Of Information</b>
            </h5>
            <p>
              On occasion there may be information on the Website/Application
              that contains inaccuracies or omissions, typographical errors,
              that may relate to Fuzion-XIO.io functions. We reserve the right to
              correct any errors, inaccuracies or omissions, and to change or
              update information.
            </p>
            <p>
              There is no undertaking or obligation to amend, update or clarify
              information on the Website/Application including, without
              limitation, data information, except as required by law. No
              specified update or refresh date applied on the
              Website/Application will be taken in indicating that all
              information on the Website/Application has been modified or
              updated.
            </p>
            <h5>
              <b>Links To Other Resources</b>
            </h5>
            <p>
              The Website/Application will link to other Websites/Applications,
              we do not approve or give approval, directly or indirectly, or
              association, sponsorship, endorsement, and affiliation with any
              linked resource, unless contained within these Terms and
              Conditions.
            </p>
            <p>
              We are not responsible or assume any liability for actions that
              are carried out by any other Third Party, or its contents. You are
              to ensure that due diligence and careful review of legal
              documents, or statements and any other conditions of use in
              browsing or using from a third-party Website/Application is
              carried out at your own risk.
            </p>
            <h5>
              <b>XAMAN Usage Data</b>
            </h5>
            <p>
              Fuzion-XIO.io operates using a XUMM wallet (https://xumm.dev). When
              using our Website/Application, you must adhere to and agree to the
              Terms & Conditions of https://xumm.dev.
            </p>
            <h5>
              <b>Prohibited Uses</b>
            </h5>
            <p>
              As contained within this Agreement, all are prohibited from using
              the Website/Application for the following.
            </p>
            <ul>
              <li>(a) for any unlawful purpose(s).</li>
              <li>
                (b) to solicit others to perform or participate in any unlawful
                acts.
              </li>
              <li>(c) to violate any UK Law or international.</li>
              <li>
                (d) to infringe upon or violate our intellectual property rights
                or the intellectual property rights of others.
              </li>
              <li>
                (e) to harass, abuse, insult, harm, defame, slander, disparage,
                intimidate, or discriminate based on gender, sexual orientation,
                religion, ethnicity, race, age, national origin, or disability.
              </li>
              <li>(f) in the submission of false or misleading information.</li>
              <li>(f) in the submission of false or misleading information.</li>
              <li>
                (h) to spam, phish, pharm, pretext, spider, crawl, or scrape.
              </li>
              <li>(i) for any obscene or immoral purpose; or </li>
              <li>
                (j) to interfere with or circumvent the security features of the
                Website/Application, third party or the Internet. We reserve the
                right to terminate your use of the Website/Application for any
                harmful or violation.
              </li>
            </ul>
            <h5>
              <b>Intellectual Property Rights</b>
            </h5>
            <p>
              “Intellectual Property Rights” is enshrined by statute, common law
              and equity in relation to copyright and their stated rights,
              trademarks, designs, patents, and inventions. All other rights to
              use, and all other intellectual property rights, in each case
              whether registered or unregistered and including all applications
              and their associated rights to apply for and be granted, rights to
              claim priority from, such rights and all similar or equivalent
              rights or forms of protection and any other results of
              intellectual activity which subsist or will subsist now or in the
              future in any part of the world.
            </p>
            <p>
              These Terms and Conditions do not have the right to transfer to
              you any intellectual property owned by Daniel Monks Fuzion-XIO.io
              or third parties, and that all rights, titles, and interests in
              and to such Website/Application will remain (between the parties)
              individually with Daniel Monks Fuzion-XIO.io. Every trademark(s),
              graphics and logos used in connection with the
              Website/Application, are trademark(s) registered of Daniel Monks
              Fuzion-XIO.io. Other trademarks, graphics and logos used in
              connection with the Website/Application may be the trademark(s) of
              other third parties. Your use of the Website/Application grants
              you no right or license to reproduce or otherwise use any of
              Daniel Monks Fuzion-XIO.io or third-party trademark(s).
            </p>
            <h5>
              <b>Disclaimer Of Warranty</b>
            </h5>
            <p>Disclaimer Of Warranty</p>
            <p>
              We at Fuzion-XIO.io expressly disclaim all warranties of any kind,
              either in an express or implied and this includes but not limited
              to all implied warranties of goods and fit for purpose including
              non-infringement. We make no warranty that the Website/Application
              will meet your requirements, or that the Website/Application will
              be uninterrupted, timely, secure, or error-free; also we do not
              include any warranty as to the results that can be obtained from
              the use of the Website/Application or its accuracy or reliability
              of any information obtained through the Website/Application or
              that defects in the Website/Application will be corrected. You
              also, agree and understand that any information/material and/or
              data downloaded or otherwise obtained through its use of the
              Website/Application will be carried out on your own discretion and
              you will be solely responsible for any damage or loss of data that
              results from the download of such material and/or data. No advice
              or information, whether oral or written, obtained by you from us
              or through the Service shall create any warranty not expressly
              made herein.
            </p>
            <h5>
              <b>Limitation Of Liability</b>
            </h5>
            <p>
              As permitted by applicable UK law, in no event will Daniel Monks
              Fuzion-XIO.io affiliates, employees, partners be liable to any
              person for any indirect, incidental, special, punitive, cover or
              consequential damages (including, without limitation, damages for
              lost profits, revenue, sales, goodwill, use of content, impact on
              business, business interruption, loss of anticipated savings, loss
              of business opportunity) however caused.
            </p>
            <p>
              In any theory of liability, including, without limitation,
              contract, tort, warranty, breach of statutory duty, negligence or
              otherwise, even if the liable party has been advised as to the
              possibility of such damages or could have foreseen such damages.
            </p>
            <p>
              The limitations and exclusions also apply if this remedy does not
              fully compensate you for any losses or fails of its essential
              purpose.
            </p>
            <h5>
              <b>Severability</b>
            </h5>
            <p>
              All rights and restrictions contained in these Terms and
              Conditions shall be applicable and binding only to the extent that
              they do not violate any applicable laws and are intended to be
              limited to the extent necessary so that they will not render this
              Agreement illegal, invalid or unenforceable.{" "}
            </p>
            <h5>
              <b>Dispute Resolution</b>
            </h5>
            <p>
              Any disputes arising out of it shall be governed by the UK Law in
              its procedural laws in its rules on conflicts. The exclusive
              jurisdiction and venue for actions related to the subject matter
              will be conducted within the courts of the United Kingdom and
              submitted in accordance with Law to the appropriate jurisdiction.
            </p>
            <p>
              Any disputes arising out of it shall be governed by the UK Law in
              its procedural laws in its rules on conflicts. The exclusive
              jurisdiction and venue for actions related to the subject matter
              will be conducted within the courts of the United Kingdom and
              submitted in accordance with Law to the appropriate jurisdiction.
            </p>
            <h5>
              <b>Assignment</b>
            </h5>
            <p>
              {" "}
              Under no circumstance you cannot assign, resell, sub-license or
              otherwise transfer or delegate any of your rights or obligations
              in whole or in part, without our prior written consent.
            </p>
            <p>
              We are free to assign any of its rights or obligations in full or
              in part, to any third party as part of the sale of all or
              substantially all its assets as part of a merger.
            </p>
            <h5>
              <b>Disclaimer</b>
            </h5>
            <p>
              The disclaimer (“Disclaimer”) sets out the Terms and Conditions
              and the general guidelines, disclosures, and terms of your use of
              the Fuzion-XIO.io (“Website” or “Application. The Disclaimer is a
              legally binding agreement between you (“User”, “you” or “your”)
              and Daniel Monks Fuzion-XIO.io (“Daniel Monks Fuzion-XIO.io”, “we”,
              “us” or “our”).
            </p>
            <p>
              In entering into this agreement on behalf of an individual,
              business or legal entity, you represent that you have the
              authority to bind such entity to the Terms and Conditions and
              agreement in which the terms “User”, “you” or “your” shall be
              used.{" "}
            </p>
            <p>
              If you do not have such authority, or if you do not agree with
              these Terms and Conditions, you must not accept this agreement and
              may not access and use the Website/Application In accessing and
              using the Website/Application you have agreed that you have read
              and understood, the Terms and Conditions of this Disclaimer. You
              have accepted that this Disclaimer is a legal contract between you
              and Daniel Monks Fuzion-XIO.io, via its electronic signature and by
              not being not physically signed by you, and it governs your use of
              the Website/Application.
            </p>
            <h5>
              <b>Representation</b>
            </h5>
            <p>
              Opinions and views represented on the Website/Application are
              personal to the individual(s) and belong solely to Daniel Monks
              Fuzion-XIO.io and do not represent other organisations that Daniel
              Monks Fuzion-XIO.io may or may not be associated with in
              professional or personal capacity unless explicitly stated.
            </p>
            <p>
              Views or opinions are not intended to malign any religion, ethnic
              group, club, organisation, company, or individual.
            </p>
            <h5>
              <b>Content And Postings</b>
            </h5>
            <p>
              You are allowed to print or copy any part of the
              Website/Application for your personal or non-commercial use.
            </p>
            <h5>
              <b>Not Financial Advice</b>
            </h5>
            <p>
              All information on the Website/Application is there at your
              convenience only and is not intended to be treated in any form as
              financial, investment, tax, or other associated advice. Nothing
              displayed contained on the Website/application constitutes a
              solicitation, recommendation, endorsement, or offer by Daniel
              Monks Fuzion-XIO.io as a financial instrument(s). All information
              on the site is of a general nature and does not address the
              circumstances of any individual or entity.
            </p>
            <p>
              You alone assume the sole responsibility of evaluating the
              associated risks with the use of any information or other content
              on the Website/Application before making any decisions based on
              such information. You agree not to hold Daniel Monks Fuzion-XIO.io
              or affiliated individual or clients liable for any possible claim
              for damages arising from any decision you make based on the
              information made available to you through the Website/Application.
            </p>
            <h5>
              <b>Not Investment Advic</b>
            </h5>
            <p>
              All investments are risky and are highly speculative in its nature
              and will involve substantial risk of loss. We as an organisation
              strongly encourage everyone to invest extremely carefully.
            </p>
            <p>
              All investments carry significant risk and all investment
              decisions of an individual remain the specific responsibility of
              that individual. All participants are encouraged and advised to
              fully understand and comprehend all risks associated with any kind
              of investing they choose to do.
            </p>
            <h5>
              <b>Indemnification And Warranties</b>
            </h5>
            <p>
              We have made all attempts to ensure that all information displayed
              or contained on the Website/Application is up to date and correct
              in its context, Daniel Monks Fuzion-XIO.io will not be responsible
              for any errors or omissions, or from any results obtained from the
              use of this information. The information displayed on the
              Website/application is provided “as is”, with no guarantee of
              completeness, accuracy, timeliness or of the results obtained from
              the use of this information, and without warranty of any kind,
              express or implied.
            </p>
            <p>
              In no circumstances will Daniel Monks Fuzion-XIO.io be made liable
              to you or anyone for decision(s) made or action taken in reliance
              on the information on the Website/Application. In line with any
              other business your results may vary and will only be based on
              individual experience and level of desire.
            </p>
            <p>
              There are no guarantees concerning and of the level of success you
              may experience. Also, we cannot make any guarantees There is no
              guarantee that you will make any income and in accessing and using
              the Website/Application you accept the risk that the earnings and
              income will differ by individual(s). Individual success will
              depend on knowledge, experience and motivation. Information
              available on the Website/Application must be based on your own
              risk and you agree that Daniel Monks Fuzion-XIO.io will not be
              liable for any success or failure of your business.
            </p>
            <p>
              Information contained on the Website/Application is subjected to
              change at any time and without warning.
            </p>
            <h5>
              <b>Changes And Amendments</b>
            </h5>
            <p>
              We have all the rights to modify/change this Disclaimer, or its
              terms and conditions in relation to the Website/Application at any
              time with our discretion. As and when we revise/change or update
              we will display this at the bottom of this page. This version of
              this Disclaimer will be effective immediately upon being displayed
              on the Website/Application. Your continued use of the
              Website/Application on being uploaded will be the effective date,
              or a revised/changed Disclaimer (or such other act specified at
              that time) will constitute all consent to changes.
            </p>
            <h5>
              <b>Acceptance Of This Disclaimer</b>
            </h5>
            <p>
              By reading the Terms and Conditions you acknowledge that you agree
              to all its terms and conditions set out within this Disclaimer. In
              accessing and using the Website/Application your agreement is
              entwined by this Disclaimer. If you disagree with the terms of the
              Disclaimer, we cannot authorise access or enter the
              Website/Application.
            </p>
            <h5>
              <b>Changes And Amendments</b>
            </h5>
            <p>
              We reserve all rights to change or amend the Terms and Conditions
              related to the Website/Application at any time. When a change or
              amendment has happened; this will be displayed at the bottom of
              this page. We may also provide notice to you in other ways at our
              discretion, such as through the contact information you have
              provided.
            </p>
            <p>
              An updated version of this Website/Application will be effective
              immediately and will be revised annually or when a change or
              amendment happens. By your continued use of the /Application after
              the Terms and Conditions are displayed will act and constitute
              your consent to those changes.
            </p>
            <h5>
              <b>Acceptance Of This Policy</b>
            </h5>
            <p>
              By reading these Terms and Conditions you acknowledge and agree to
              all its terms and conditions. In accessing and using the
              Website/Application an agreement is bounded by this Policy. If you
              are in any disagreement and do act accordingly by abiding to the
              Policy, you are not permitted to access or use.
            </p>
            <h5>
              <b>Contacting Us</b>
            </h5>
            <p>
              If you have any questions, concerns, or complaints regarding these
              Terms and Conditions, please do not hesitate to contact us using
              the details below:
            </p>
            <p>
              <a href="mailto:Info@DPMonksFinance.com">Info@DPMonksFinance.com</a>
            </p>
            <p>This document was last updated on February 16, 2023</p>
          </div>
        </Modal.Body>
      </Modal>
      <Modal
        show={discModal}
        onHide={handleCloseDisc}
        backdrop="static"
        className="privacyModal"
      >
        <Modal.Header closeButton className="px-md-5 px-lg-5 px-xl-5">
          <Modal.Title>
            <strong className="text-info">NFT DISCLAIMER</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-md-5 px-lg-5 px-xl-5 discBody">
          <ul>
            <li>
              <p>
                By creating/minting an NFT on the Fuzion-XIO application or smart
                device applications, you (the user) take full custody of the
                initial creation and are responsible for its design,
                illustration, 3D video or audio or anything similar displayed.
                By agreeing to this disclaimer you remove all liabilities of the
                design from the Fuzion-XIO application and connections to its
                creators, founders and partners.
              </p>
            </li>
            <li>
              <p>
                The Design you create/mint must be your own personal design,
                illustration, 3D video or audio. If you are using content from
                another creator, company logo, commercial brand or anything
                similar created by someone else you must ask permission to use
                their content and receive written consent before creating your
                NFT.
              </p>
            </li>
            <li>
              <p>
                Purchasing an NFT off the secondary market, or otherwise
                acquiring the NFT through any other legitimate means or method,
                the Holder receives full and complete ownership, inclusive of
                commercial rights, to the NFT and the corresponding unique
                artwork.
              </p>
            </li>
            <li>
              <p>
                The License the Holder is receiving is solely for the Licensed
                NFT which includes the right to use the NFT, and the right to
                reproduce the NFT on tribute or derivative art, merchandise, or
                sharing these rights with third party projects.
              </p>
            </li>
            <li>
              <p>
                The Creator agrees not to use, utilize, portray, advertise,
                distribute or otherwise market any NFT in any project or
                derivative work that involves hate speech, racism, pornography,
                or any other illegal or unlawful content. Upon sale or transfer
                of the NFT, any ownership or commercial rights are immediately
                transferred to the new Holder.
              </p>
            </li>
            <li>
              <p>
                No refunds shall be issued to any Holder upon a full and
                complete lawful purchase of any NFT. In the event that any
                Holder purchases an NFT through the secondary market, the holder
                shall be held accountable and will be bound by the Terms of
                Service which govern said secondary market platform.
              </p>
            </li>
            <li>
              <p>
                NFT’s may bear elements of transformative fan art or caricatures
                which are rendered in good faith to add humour and satire to the
                project. Any Holder of an NFT bearing these elements has an
                individual responsibility to determine the appropriateness of
                subsequent usage. Any Attributes associated to an NFT is used as
                a parody. These attributes are not sponsored, endorsed by or
                affiliated by any affiliated companies and/or third party
                licensors.
              </p>
            </li>
            <li>
              <p>
                Participants in creating/minting NFTs agree to hold the project
                Creative Team harmless for any losses incurred as a consequence
                of creating/minting an NFT. These potential losses include any
                fees for failed transactions, any excessive fees charged due to
                website/application or smart contract issues, and any loss of
                any NFT’s due to website/application or smart contract
                malfunctions.
              </p>
            </li>
            <li>
              <p>
                {" "}
                NFTs are created purely as collectibles, not as investment
                vehicles or substitutes for cryptocurrency. We make absolutely
                no promise or guarantee that these NFTs will subsequently retain
                monetary value in fiat, cash or cryptocurrency.
              </p>
            </li>
            <li>
              <p>
                Each Holder is solely and entirely responsible for any and all
                Federal or State tax liabilities which may arise, be imposed, or
                enforced as a result of minting or reselling NFTs on the RaDical
                X website/application.
              </p>
            </li>
            <li>
              <p>
                {" "}
                You agree to waive any class action status, and any legal
                dispute around the Fuzion-XIO Application which you may choose to
                bring, can only be done on an individual basis.
              </p>
            </li>
          </ul>
        </Modal.Body>
      </Modal>
    </React.Fragment>
  );
}

export default Footer;
