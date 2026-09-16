import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },
    assignedCourses: {
      type: [String], // Temporarily Strings until Course model is ready
      default: [],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    plainPassword: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Student || mongoose.model("Student", StudentSchema);
