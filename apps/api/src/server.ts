import dotenv from "dotenv";

// Load .env BEFORE importing anything that reads process.env
dotenv.config();

import app from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`ProcurePilot API running on port ${env.PORT}`);
});
