require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
// Configuration
const CACHE_DURATION = 300; // seconds for Cache-Control header

// Middleware
app.use(cors());
app.use(express.json()); // parse application/json

// --- Mongoose model ---
const skipRangeSchema = new mongoose.Schema(
  {
    episodeId: { type: String, required: true, unique: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { timestamps: true }
);
const SkipRange = mongoose.model("SkipRange", skipRangeSchema);

// --- Routes ---

// Create or update a skip range
app.post("/ranges", async (req, res) => {
  const { episodeId, start, end } = req.body;
  if (!episodeId || typeof start !== "number" || typeof end !== "number") {
    console.log(`[Server] Invalid POST body for episode ${episodeId}`);
    return res
      .status(400)
      .json({ error: "episodeId, start and end are required" });
  }
  try {
    const range = await SkipRange.findOneAndUpdate(
      { episodeId },
      { start, end },
      { upsert: true, new: true, runValidators: true }
    );
    res.set("Cache-Control", `public, max-age=${CACHE_DURATION}`);
    console.log(
      `[Server] Saved range for ${episodeId}: start=${start}, end=${end}`
    );
    return res.json(range);
  } catch (err) {
    console.error("[Server] Database error on POST /ranges:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// Get a skip range by episode ID
// 200 with JSON if found, 204 No Content if not
app.get("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  res.set("Cache-Control", `public, max-age=${CACHE_DURATION}`);
  try {
    const range = await SkipRange.findOne({ episodeId });
    if (!range) {
      console.log(`[Server] No range for ${episodeId}, returning 204`);
      return res.sendStatus(204);
    }
    console.log(`[Server] Found range for ${episodeId}`);
    return res.status(200).json(range);
  } catch (err) {
    console.error("[Server] Database error on GET /ranges:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// HEAD to check existence (200 if found, 204 if not)
app.head("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  res.set("Cache-Control", `public, max-age=${CACHE_DURATION}`);
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

// Delete a skip range
app.delete("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  try {
    const result = await SkipRange.deleteOne({ episodeId });
    res.set("Cache-Control", `public, max-age=${CACHE_DURATION}`);
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

// --- Start server ---
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/skiprange";

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
