import mongoose from "mongoose";

const superAdminSchema = new mongoose.Schema(
  {
    identityNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.SuperAdmin ||
  mongoose.model("SuperAdmin", superAdminSchema);
