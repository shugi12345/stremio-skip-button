require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/skiprange";

// --- Middleware ---
app.use(cors());
app.use(express.json()); // parse application/json

// --- Mongoose models ---
const skipRangeSchema = new mongoose.Schema(
  {
    episodeId: { type: String, required: true, unique: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    title: { type: String },
  },
  { timestamps: true }
);
const SkipRange = mongoose.model("SkipRange", skipRangeSchema);

// GET /offsets/:fileId - get offset for a file
app.get("/offsets/:fileId", async (req, res) => {
  const { fileId } = req.params;
  try {
    const result = await Offset.findOne({ fileId });
    if (!result) {
      console.log(`[Server] No offset for fileId=${fileId}, returning 0`);
      return res.json({ offset: 0 });
    }
    console.log(`[Server] Fetched offset for fileId=${fileId}: offset=${result.offset}`);
    return res.json({ offset: result.offset });
  } catch (err) {
    console.error("[Server] Error fetching offset:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// --- Routes ---

// POST /ranges - create or update skip range
app.post("/ranges", async (req, res) => {
  const { episodeId, start, end, offset, title } = req.body;
  if (!episodeId || typeof start !== "number" || typeof end !== "number" || typeof offset !== "number") {
    console.log(
      `[Server] Invalid POST body: episodeId=${episodeId}, start=${start}, end=${end}, offset=${offset}, title=${title}`
    );
    return res
      .status(400)
      .json({ error: "episodeId, start, end and offset are required" });
  }

  try {
    const range = await SkipRange.findOneAndUpdate(
      { episodeId },
      { start, end, offset, title },
      { upsert: true, new: true, runValidators: true }
    );
    console.log(
      `[Server] Saved range for ${episodeId} (${title}): start=${start}, end=${end}, offset=${offset}`
    );
    return res.json(range);
  } catch (err) {
    console.error("[Server] Database error on POST /ranges:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// GET /ranges/:episodeId - return skip range or 204 if not found
app.get("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  res.set("Cache-Control", "no-store");
  try {
    const range = await SkipRange.findOne({ episodeId });
    if (!range) {
      console.log(`[Server] No range for ${episodeId}, returning 204`);
      return res.sendStatus(204);
    }
    console.log(
      `[Server] Fetched range for ${episodeId} (${range.title}): start=${range.start}, end=${range.end}, offset=${range.offset}`
    );
    return res.status(200).json(range);
  } catch (err) {
    console.error("[Server] Database error on GET /ranges:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// GET /download-db - download a JSON copy of the database
app.get("/download-db", async (req, res) => {
  try {
    const ranges = await SkipRange.find().lean();
    res.setHeader("Content-Disposition", "attachment; filename=skipranges.json");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(ranges, null, 2));
  } catch (err) {
    console.error("[Server] Error while downloading the database :", err);
    res.status(500).json({ error: "Server error" });
  }
});

// HEAD /ranges/:episodeId - check if exists (200 or 204)
app.head("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  res.set("Cache-Control", "no-store");
  try {
    const exists = await SkipRange.exists({ episodeId });
    const status = exists ? 200 : 204;
    console.log(`[Server] HEAD /ranges/${episodeId} => ${status}`);
    return res.sendStatus(status);
  } catch (err) {
    console.error("[Server] Database error on HEAD /ranges:", err);
    return res.sendStatus(500);
  }
});

// DELETE /ranges/:episodeId - remove a range
app.delete("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  res.set("Cache-Control", "no-store");
  try {
    const result = await SkipRange.deleteOne({ episodeId });
    if (result.deletedCount === 0) {
      console.log(`[Server] No range to delete for ${episodeId}`);
      return res.status(404).json({ error: "Not found" });
    }
    console.log(`[Server] Deleted range for ${episodeId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[Server] Database error on DELETE /ranges:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Start server ---
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("[Server] MongoDB connected");
    app.listen(PORT, () => {
      console.log(`[Server] Listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[Server] MongoDB connection error:", err);
    process.exit(1);
  });
