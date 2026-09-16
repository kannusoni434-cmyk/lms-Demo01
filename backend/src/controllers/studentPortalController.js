import CourseAccess from '../models/CourseAccess.js';
import Video from '../models/Video.js';
import { hasCourseAccess } from '../services/courseAccessService.js';
import Course from '../models/Course.js';
import Student from '../models/Student.js';
import bcrypt from 'bcryptjs';

export const getMyDashboard = async (req, res) => {
  try {
    const studentId = req.user.userId;
    
    // Check if student exists and is active
    const student = await Student.findById(studentId);
    if (!student || student.status !== 'active') {
      return res.status(403).json({ error: 'Your account is currently inactive.' });
    }

    const now = new Date();
    
    // Get assigned course count (total course access records for this student)
    const assignedCoursesCount = await CourseAccess.countDocuments({
      studentId,
    });

    res.status(200).json({
      name: student.name,
      studentId: student.studentId,
      phone: student.phone,
      status: student.status,
      assignedCoursesCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

export const getMyCourses = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const student = await Student.findById(studentId);
    if (!student || student.status !== 'active') {
      return res.status(403).json({ error: 'Your account is currently inactive.' });
    }

    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(0,0,0,0);

    const accessRecords = await CourseAccess.find({
      studentId,
      status: 'active',
      startDate: { $lte: now }
    }).populate('courseId');

    const accessibleCourses = accessRecords.filter(record => {
      // Expiry logic
      const expiry = new Date(record.expiryDate);
      expiry.setHours(23, 59, 59, 999);
      if (now > expiry) return false;

      // Course must exist
      if (!record.courseId) return false;

      return true;
    }).map(record => ({
      _id: record.courseId._id,
      name: record.courseId.name,
      description: record.courseId.description,
      thumbnail: record.courseId.thumbnail,
      status: record.courseId.status,
      expiryDate: record.expiryDate
    }));

    // For video counts, we can fetch them or just return courses
    // To keep it performant, we might skip video count unless strictly necessary, 
    // but the prompt says "12 Videos", so let's fetch video counts
    for (let course of accessibleCourses) {
       course.videoCount = await Video.countDocuments({ courseId: course._id });
    }

    res.status(200).json(accessibleCourses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

export const getCourseDetails = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { courseId } = req.params;

    const accessCheck = await hasCourseAccess(studentId, courseId);
    if (!accessCheck.hasAccess) {
      return res.status(403).json({ error: accessCheck.reason });
    }

    const course = await Course.findById(courseId);
    const courseObj = course.toObject();
    if (accessCheck.accessRecord) {
      courseObj.expiryDate = accessCheck.accessRecord.expiryDate;
    }
    res.status(200).json(courseObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
};

export const getCourseVideos = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { courseId } = req.params;

    const accessCheck = await hasCourseAccess(studentId, courseId);
    if (!accessCheck.hasAccess) {
      return res.status(403).json({ error: accessCheck.reason });
    }

    const videos = await Video.find({ courseId }).sort({ createdAt: -1 });
    res.status(200).json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch course videos' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const student = await Student.findById(studentId);
    if (!student || student.status !== 'active') {
      return res.status(403).json({ error: 'Your account is currently inactive' });
    }

    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    student.password = hashedPassword;
    await student.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};
