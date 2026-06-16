import mongoose from "mongoose";

const adminActionLogSchema = new mongoose.Schema(
  {
    actorIts: { type: String, required: true }, // admin/super-admin who performed it
    actorRole: { type: String, default: "admin" }, // "admin" | "superAdmin"
    action: { type: String, required: true }, // e.g. CREATE_USER, DELETE_USER
    targetIts: { type: String, default: null }, // affected user (null for bulk)
    details: { type: String, default: null }, // extra context
  },
  { timestamps: true }
);

adminActionLogSchema.index({ createdAt: -1 });

export default mongoose.models.AdminActionLog ||
  mongoose.model("AdminActionLog", adminActionLogSchema);
