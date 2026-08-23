import "dotenv/config";
import express from "express";
import cors from "cors";
import { readStore, resetStore } from "./lib/store.js";
import { demoSeed, STORE_VERSION } from "./lib/seed.js";
import exchange from "./routes/exchange.js";
import market from "./routes/market.js";
import mint, { uploadDir } from "./routes/mint.js";
import assets from "./routes/assets.js";
import profiles from "./routes/profiles.js";
import profileShare from "./routes/profileShare.js";

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "12mb" }));

const store = readStore();
if (!store.nfts.length || store.version !== STORE_VERSION) {
  resetStore(demoSeed());
}

app.use("/api/uploads", express.static(uploadDir));
app.use("/uploads", express.static(uploadDir));
app.use("/api/market", market);
app.use("/api/assets", assets);
app.use("/api", profiles);
app.use(profileShare);
app.use("/api", mint);
app.use(mint);
app.use("/api", exchange);
app.use(exchange);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `No local route for ${req.method} ${req.path}`
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`FUZION-XIO API on http://127.0.0.1:${port}`);
  console.log("Fresh store (old Mongo index dumps were not imported).");
});
