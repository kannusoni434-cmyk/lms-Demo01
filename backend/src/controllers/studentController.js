import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Student from '../models/Student.js';
import Counter from '../models/Counter.js';
import CourseAccess from '../models/CourseAccess.js';

export const getStudents = async (req, res) => {
  try {
    const students = await Student.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id).select('-password');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student details' });
  }
};

export const createStudent = async (req, res) => {
  try {
    const { name, phone, password, courseIds } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    const prefix = 'STU-JC';

    const counter = await Counter.findByIdAndUpdate(
      prefix,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    const sequenceNumber = String(counter.seq).padStart(3, '0');
    const studentId = `${prefix}${sequenceNumber}`;

    const rawPassword = password || crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const student = await Student.create({
      studentId, name, phone, password: hashedPassword, plainPassword: rawPassword, status: 'active', assignedCourses: []
    });

    if (courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
      const startDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const accessDocs = courseIds.map(cid => ({
        studentId: student._id,
        courseId: cid,
        startDate,
        expiryDate,
        status: 'active'
      }));
      await CourseAccess.insertMany(accessDocs);
      
      // Update student's internal array for admin UI counting
      student.assignedCourses = courseIds;
      await student.save();
    }

    res.status(201).json({ success: true, studentId: student.studentId, password: rawPassword, name: student.name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create student' });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };
    
    if (updateData.phone && !/^\d{10}$/.test(updateData.phone)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    if (updateData.password) {
      updateData.plainPassword = updateData.password;
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const student = await Student.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student' });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findByIdAndDelete(id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
};
