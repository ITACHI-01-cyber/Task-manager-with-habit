import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";

if (MONGODB_URI.includes("localhost")) {
  console.warn("⚠️  Warning: MONGODB_URI not found in environment, falling back to localhost.");
} else {
  console.log("✅ MONGODB_URI loaded successfully.");
}

const app = express();
app.use(express.json({ limit: '10mb' }));

let cachedClient: MongoClient | null = null;
let cachedDbCollection: any = null;

async function connectDB() {
  if (cachedDbCollection) return cachedDbCollection;
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log("🚀 Successfully connected to MongoDB cluster!");
    const database = client.db("habit_tracker");
    cachedClient = client;
    cachedDbCollection = database.collection("app_data");
    return cachedDbCollection;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    return null;
  }
}

  // API routes
  app.get("/api/data", async (req, res) => {
    try {
      const dbCollection = await connectDB();
      if (dbCollection) {
        const row = await dbCollection.findOne({ id: 1 });
        if (row) {
          res.json(JSON.parse(row.content));
          return;
        }
      }

      // Fallback to data.json if it exists (migration)
      const DATA_FILE = path.join(__dirname, "data.json");
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, "utf-8");
        res.json(JSON.parse(data));
      } else {
        res.json({});
      }
    } catch (e) {
      console.error("DB Read Error:", e);
      res.status(500).json({ error: "Failed to read data from database" });
    }
  });

  app.post("/api/data", async (req, res) => {
    try {
      const dbCollection = await connectDB();
      if (!dbCollection) {
        return res.status(500).json({ error: "Database not connected" });
      }
      const content = JSON.stringify(req.body);
      await dbCollection.updateOne(
        { id: 1 },
        { $set: { id: 1, content } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (e) {
      console.error("DB Write Error:", e);
      res.status(500).json({ error: "Failed to save data to database" });
    }
  });

  // Start server logic (For local development only)
  if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.join(__dirname, "dist")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "dist", "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

// Export for Vercel Serverless
export default app;
