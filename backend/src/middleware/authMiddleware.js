import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';

export const verifyAdmin = async (req, res, next) => {
  const possibleTokens = [req.cookies.admin_token, req.cookies.student_token, req.cookies.token, req.query.token].filter(Boolean);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    possibleTokens.push(authHeader.substring(7));
  }
  
  if (possibleTokens.length === 0) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  let hasValidTokenWrongRole = false;

  for (const token of possibleTokens) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
      if (decoded.role === 'admin') {
        const admin = await Admin.findById(decoded.userId);
        if (admin && admin.currentSessionId && decoded.sessionId && admin.currentSessionId !== decoded.sessionId) {
          return res.status(401).json({ success: false, message: 'SESSION_CONFLICT' });
        }
        req.user = decoded;
        return next();
      } else {
        hasValidTokenWrongRole = true;
      }
    } catch (err) {
      // Continue to the next token
    }
  }

  if (hasValidTokenWrongRole) {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  }

  return res.status(401).json({ success: false, message: 'Unauthorized or invalid token' });
};

export const verifyStudent = async (req, res, next) => {
  const possibleTokens = [req.cookies.student_token, req.cookies.admin_token, req.cookies.token, req.query.token].filter(Boolean);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    possibleTokens.push(authHeader.substring(7));
  }
  
  if (possibleTokens.length === 0) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  let hasValidTokenWrongRole = false;

  for (const token of possibleTokens) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
      if (decoded.role === 'student') {
        const student = await Student.findById(decoded.userId);
        if (student && student.currentSessionId && decoded.sessionId && student.currentSessionId !== decoded.sessionId) {
          return res.status(401).json({ success: false, message: 'SESSION_CONFLICT' });
        }
        req.user = decoded;
        return next();
      } else {
        hasValidTokenWrongRole = true;
      }
    } catch (err) {
      // Continue to the next token
    }
  }

  if (hasValidTokenWrongRole) {
    return res.status(403).json({ success: false, message: 'Forbidden: Student access required' });
  }

  return res.status(401).json({ success: false, message: 'Unauthorized or invalid token' });
};

export const verifyAuth = async (req, res, next) => {
  const possibleTokens = [req.cookies.admin_token, req.cookies.student_token, req.cookies.token, req.query.token].filter(Boolean);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    possibleTokens.push(authHeader.substring(7));
  }
  
  if (possibleTokens.length === 0) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  for (const token of possibleTokens) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
      let userDoc;
      if (decoded.role === 'admin') {
        userDoc = await Admin.findById(decoded.userId);
      } else if (decoded.role === 'student') {
        userDoc = await Student.findById(decoded.userId);
      }
      if (userDoc && userDoc.currentSessionId && decoded.sessionId && userDoc.currentSessionId !== decoded.sessionId) {
        return res.status(401).json({ success: false, message: 'SESSION_CONFLICT' });
      }
      req.user = decoded;
      return next();
    } catch (err) {
      // Continue to the next token
    }
  }

  return res.status(401).json({ success: false, message: 'Invalid token' });
};
