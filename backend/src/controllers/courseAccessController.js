import CourseAccess from '../models/CourseAccess.js';
import Course from '../models/Course.js';
import Student from '../models/Student.js';

export const getStudentCourseAccess = async (req, res) => {
  try {
    const { studentId } = req.params;
    const accessRecords = await CourseAccess.find({ studentId }).populate('courseId', 'name status');
    res.status(200).json(accessRecords);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch course access records' });
  }
};

export const assignCourse = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseId, startDate, expiryDate } = req.body;

    if (!courseId || !startDate || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (new Date(startDate) >= new Date(expiryDate)) {
      return res.status(400).json({ error: 'Expiry date must be after start date' });
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const existingAccess = await CourseAccess.findOne({ studentId, courseId });
    if (existingAccess) {
      return res.status(400).json({ error: 'Student already has access to this course' });
    }

    const newAccess = await CourseAccess.create({
      studentId,
      courseId,
      startDate,
      expiryDate,
      status: 'active'
    });

    if (student.assignedCourses && !student.assignedCourses.includes(courseId.toString())) {
      student.assignedCourses.push(courseId.toString());
      await student.save();
    }

    res.status(201).json(newAccess);
  } catch (error) {
    if (error.code === 11000) {
       return res.status(400).json({ error: 'Student already has access to this course' });
    }
    res.status(500).json({ error: 'Failed to assign course' });
  }
};

export const editCourseAccess = async (req, res) => {
  try {
    const { studentId, accessId } = req.params;
    const { courseId, startDate, expiryDate } = req.body;

    if (new Date(startDate) >= new Date(expiryDate)) {
      return res.status(400).json({ error: 'Expiry date must be after start date' });
    }

    const access = await CourseAccess.findOne({ _id: accessId, studentId });
    if (!access) return res.status(404).json({ error: 'Access record not found' });

    if (courseId && courseId !== access.courseId.toString()) {
      const duplicate = await CourseAccess.findOne({ studentId, courseId });
      if (duplicate) {
        return res.status(400).json({ error: 'Student already has access to the selected course' });
      }
      access.courseId = courseId;
    }

    access.startDate = startDate;
    access.expiryDate = expiryDate;
    await access.save();

    res.status(200).json(access);
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit course access' });
  }
};

export const revokeCourseAccess = async (req, res) => {
  try {
    const { studentId, accessId } = req.params;
    const access = await CourseAccess.findOneAndUpdate(
      { _id: accessId, studentId },
      { status: 'revoked' },
      { new: true }
    );
    if (!access) return res.status(404).json({ error: 'Access record not found' });
    res.status(200).json(access);
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke course access' });
  }
};

export const restoreCourseAccess = async (req, res) => {
  try {
    const { studentId, accessId } = req.params;
    
    const access = await CourseAccess.findOne({ _id: accessId, studentId });
    if (!access) return res.status(404).json({ error: 'Access record not found' });

    const course = await Course.findById(access.courseId);
    if (!course) {
      return res.status(400).json({ error: 'Cannot restore access: Course no longer exists' });
    }
    if (course.status !== 'active') {
      return res.status(400).json({ error: 'Cannot restore access: Course is currently inactive' });
    }
    
    if (new Date() > new Date(access.expiryDate)) {
       return res.status(400).json({ error: 'Cannot restore access: Expiry date has passed. Please extend first.' });
    }

    access.status = 'active';
    await access.save();

    res.status(200).json(access);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore course access' });
  }
};

export const deleteCourseAccess = async (req, res) => {
  try {
    const { studentId, accessId } = req.params;

    const access = await CourseAccess.findOneAndDelete({ _id: accessId, studentId });
    if (!access) return res.status(404).json({ error: 'Access record not found' });

    // Remove the courseId from the student's assignedCourses array to keep counts accurate
    const student = await Student.findById(studentId);
    if (student && student.assignedCourses) {
      student.assignedCourses = student.assignedCourses.filter(
        id => id.toString() !== access.courseId.toString()
      );
      await student.save();
    }

    res.status(200).json({ success: true, message: 'Course access deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete course access' });
  }
};
