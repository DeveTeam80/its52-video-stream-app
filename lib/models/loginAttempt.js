import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema(
  {
    identityNumber: {
      type: String,
      required: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.LoginAttempt ||
  mongoose.model("LoginAttempt", loginAttemptSchema);
