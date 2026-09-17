import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    currentSessionId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// If the model is already compiled, use that, otherwise compile it.
export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
