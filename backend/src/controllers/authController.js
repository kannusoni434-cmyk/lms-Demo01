import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';

const generateTokenAndSetCookie = (res, payload) => {
  const secret = process.env.JWT_SECRET || 'default_jwt_secret';
  const token = jwt.sign(payload, secret, { expiresIn: '7d' });
  
  const cookieName = payload.role === 'admin' ? 'admin_token' : 'student_token';
  
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return token;
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const sessionId = crypto.randomUUID();
    admin.currentSessionId = sessionId;
    await admin.save();

    const token = generateTokenAndSetCookie(res, { role: 'admin', userId: admin._id, sessionId });
    res.status(200).json({ success: true, message: 'Admin logged in successfully', token });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const studentLogin = async (req, res) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) return res.status(400).json({ error: 'Student ID and password are required' });

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(401).json({ error: 'Invalid credentials' });
    if (student.status === 'blocked') return res.status(403).json({ error: 'Your account has been blocked' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const sessionId = crypto.randomUUID();
    student.currentSessionId = sessionId;
    await student.save();

    const token = generateTokenAndSetCookie(res, { role: 'student', userId: student._id, sessionId });
    res.status(200).json({ success: true, message: 'Student logged in successfully', token });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logout = (req, res) => {
  res.cookie('admin_token', '', { maxAge: 0, path: '/' });
  res.cookie('student_token', '', { maxAge: 0, path: '/' });
  res.cookie('token', '', { maxAge: 0, path: '/' });
  res.status(200).json({ success: true });
};
