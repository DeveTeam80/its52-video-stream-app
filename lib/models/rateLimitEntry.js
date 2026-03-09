import mongoose from "mongoose";

const rateLimitEntrySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: auto-delete entries after 15 minutes
rateLimitEntrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

export default mongoose.models.RateLimitEntry ||
  mongoose.model("RateLimitEntry", rateLimitEntrySchema);
