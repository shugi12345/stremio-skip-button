require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

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
    res.json(range);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get a skip range by episode ID
app.get("/ranges/:episodeId", async (req, res) => {
  try {
    const range = await SkipRange.findOne({ episodeId: req.params.episodeId });
    if (!range) return res.status(404).json({ error: "Not found" });
    res.json(range);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// (Optional) Delete a skip range
app.delete("/ranges/:episodeId", async (req, res) => {
  try {
    const result = await SkipRange.deleteOne({
      episodeId: req.params.episodeId,
    });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/skiprange";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
