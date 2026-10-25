import { resetStore } from "../lib/store.js";
import { demoSeed } from "../lib/seed.js";

resetStore(demoSeed());
console.log("Local exchange store reset to the demo seed. Old Mongo dumps were not imported.");
