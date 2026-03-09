import mongoose from "mongoose";

const refreshSignalSchema = new mongoose.Schema({
  triggeredAt: {
    type: Date,
    default: Date.now,
  },
  adminTriggeredAt: {
    type: Date,
    default: null,
  },
});

export default mongoose.models.RefreshSignal ||
  mongoose.model("RefreshSignal", refreshSignalSchema);
