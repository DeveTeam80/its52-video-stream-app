import mongoose from "mongoose";

const youtubeSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: "Please enter your number",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Youtube || mongoose.model("Youtube", youtubeSchema);
