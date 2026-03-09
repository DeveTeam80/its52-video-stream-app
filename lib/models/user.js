import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    identityNumber: {
      type: String,
      required: "Please enter your number",
      trim: true,
    },
    activeStatus: {
      type: Boolean,
      default: false,
    },
    loggedInToday: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
