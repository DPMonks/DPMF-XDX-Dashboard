# FUZION-XIO local API

Fresh Express API for the recovered Radical-X / FUZION-XIO frontend.

The Mongo dumps that were uploaded were **index metadata only** (`DPMonksFinance-BLCH-cansultant` and `DPMonksFinance_NEWPROD`). Those databases are not imported. The store starts empty and is seeded with four demo listings.

Radical-X `portal` used Express + Mongoose + `xumm-sdk` + `xrpl`. This step keeps Express and a clearable JSON store so the marketplace can run without Mongo or Xaman keys. Signing routes return a “not wired yet” payload.

## Run

```bash
cd fuzion-xio-api
npm install
npm start
```

Health: `GET http://127.0.0.1:8080/api/health`  
Home catalog: `GET http://127.0.0.1:8080/api/nft/home`

Reset demo data:

```bash
npm run reset
```

## Working now

- Home catalog, list, detail, like
- Profiles and vScore/XIO boards
- Frontend same-origin `/api` via the Vite proxy

## Next

- Xaman connect / mint / buy / sell (`xumm-sdk`, `xrpl`)
- Optional Mongo if you want the old collection names back
