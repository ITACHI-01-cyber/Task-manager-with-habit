import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, "habit_tracker.db");
const db = new Database(DB_FILE);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS app_data (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.get("/api/data", (req, res) => {
    try {
      const row = db.prepare("SELECT content FROM app_data WHERE id = 1").get() as { content: string } | undefined;
      if (row) {
        res.json(JSON.parse(row.content));
      } else {
        // Fallback to data.json if it exists (migration)
        const DATA_FILE = path.join(__dirname, "data.json");
        if (fs.existsSync(DATA_FILE)) {
          const data = fs.readFileSync(DATA_FILE, "utf-8");
          res.json(JSON.parse(data));
        } else {
          res.json({});
        }
      }
    } catch (e) {
      console.error("DB Read Error:", e);
      res.status(500).json({ error: "Failed to read data from database" });
    }
  });

  app.post("/api/data", (req, res) => {
    try {
      const content = JSON.stringify(req.body);
      db.prepare(`
        INSERT INTO app_data (id, content) VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET content = excluded.content
      `).run(content);
      res.json({ success: true });
    } catch (e) {
      console.error("DB Write Error:", e);
      res.status(500).json({ error: "Failed to save data to database" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

startServer();
