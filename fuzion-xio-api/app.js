import "dotenv/config";
import express from "express";
import cors from "cors";
import { readStore, resetStore } from "./lib/store.js";
import { demoSeed } from "./lib/seed.js";
import exchange from "./routes/exchange.js";

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "4mb" }));

if (readStore().nfts.length === 0) {
  resetStore(demoSeed());
}

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
