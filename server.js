require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/skiprange";
const CurrentVersion = "1.1.0";

app.use(cors());
app.use(express.json());

// --- Mongoose model with a Map for offsets ---
const skipRangeSchema = new mongoose.Schema(
  {
    episodeId: { type: String, required: true, unique: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    title: { type: String },
    offsets: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

const SkipRange = mongoose.model("SkipRange", skipRangeSchema);

// --- POST /ranges ---
// Body: { episodeId, start, end, fileId, offset, title? }
app.post("/ranges", async (req, res) => {
  const { episodeId, fileId, start, end, offset, title } = req.body;
  if (
    !episodeId ||
    !fileId ||
    typeof start !== "number" ||
    typeof end !== "number" ||
    typeof offset !== "number"
  ) {
    console.error("[Server] POST /ranges missing required fields:", req.body);
    return res
      .status(400)
      .json({ error: "episodeId, start, end, fileId and offset are required" });
  }

  try {
    const update = {
      start,
      end,
      title,
      [`offsets.${fileId}`]: offset,
    };

    const range = await SkipRange.findOneAndUpdate(
      { episodeId },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );
    console.log(
      `Saved range for ${episodeId} (${title}): start=${range.start}, end=${
        range.end
      }, offset=${range.offsets.get(fileId)}`
    );
    return res.json(range);
  } catch (err) {
    console.error("[Server] POST /ranges error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// --- GET /ranges/:episodeId?fileId=XYZ ---
// Returns 204 if no episode
app.get("/ranges/:episodeId", async (req, res) => {
  const { episodeId } = req.params;
  const { fileId, title } = req.query;
  if (!fileId) {
    return res
      .status(400)
      .json({ error: "fileId query parameter is required" });
  }

  try {
    const range = await SkipRange.findOne({ episodeId });
    if (!range) {
      console.log(`[Server] No range found for ${episodeId}: (${title})`);
      return res.sendStatus(204);
    }
    const offset = range.offsets.get(fileId);
    console.log(
      `Fetched range for ${episodeId} (${title}): start=${range.start}, end=${
        range.end
      }, offset=${range.offsets.get(fileId)}`
    );
    return res.json({
      start: range.start,
      end: range.end,
      offset: offset,
    });
  } catch (err) {
    console.error("[Server] GET /ranges error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.get("/plugin-version", (req, res) => {
  res.json({ version: CurrentVersion });
});

app.get("/download-db", async (req, res) => {
  try {
    const ranges = await SkipRange.find().lean();
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=skipranges.json"
    );
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(ranges, null, 2));
  } catch (err) {
    console.error("[Server] download-db error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/ranges/:episodeId", async (req, res) => {
  try {
    const result = await SkipRange.deleteOne({
      episodeId: req.params.episodeId,
    });
    if (result.deletedCount === 0)
      return res.status(204).json({ error: "Not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("[Server] DELETE /ranges error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() =>
    app.listen(PORT, () => {
      console.log(`[Server] Listening on http://localhost:${PORT}`);
    })
  )
  .catch((err) => {
    console.error("[Server] MongoDB connection error:", err);
    process.exit(1);
  });
