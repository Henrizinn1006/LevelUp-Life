import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import stateRoutes from "./routes/state.js";

import { initDB } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

initDB();

// Static frontend
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

// Rotas API
app.use("/auth", authRoutes);
app.use("/api", stateRoutes);

// Frontend pages
app.get("/", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "login.html"))
);

app.get("/app", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "app.html"))
);

app.listen(3001, () => {
  console.log("Server ON: http://localhost:3001");
});
