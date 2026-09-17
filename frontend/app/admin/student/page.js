"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Suspense } from "react";

function StudentDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [student, setStudent] = useState(null);
  const [accessRecords, setAccessRecords] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingAccess, setEditingAccess] = useState(null);

  const fetchStudentData = async () => {
    setLoading(true);
    setError("");
    try {
      const [studentRes, accessRes, coursesRes] = await Promise.all([
        fetchApi(`/students/${id}`),
        fetchApi(`/students/${id}/course-access`),
        fetchApi("/courses")
      ]);

      if (!studentRes.ok) throw new Error("Failed to fetch student details");
      const studentData = await studentRes.json();
      setStudent(studentData);

      if (accessRes.ok) {
        setAccessRecords(await accessRes.json());
      }
      if (coursesRes.ok) {
        setCourses((await coursesRes.json()).filter(c => c.status === 'active'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  const handleDeleteAccess = async (accessId) => {
    if (!confirm("Are you sure you want to permanently delete this course access? This action cannot be undone.")) return;
    try {
      const res = await fetchApi(`/students/${id}/course-access/${accessId}`, { method: "DELETE" });
      if (res.ok) fetchStudentData();
      else alert((await res.json()).error || "Failed to delete access");
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm("Are you sure you want to generate a new password for this student?")) return;
    
    // Generate a random 8-character password
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$*";
    let newPassword = "";
    for (let i = 0; i < 8; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    try {
      const res = await fetchApi(`/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (res.ok) {
        alert(`Password reset successfully!\n\nNew Password: ${newPassword}\n\nPlease copy this and share it with the student.`);
        fetchStudentData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reset password");
      }
    } catch (e) {
      alert("An unexpected error occurred");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#c71e22] mb-4"></div>
        <p className="text-gray-500 font-medium text-sm">Loading student details...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <p className="text-gray-600 font-medium mb-4">{error || "Student not found"}</p>
        <Link href="/admin/students" className="text-[#c71e22] hover:underline font-semibold text-sm">&larr; Back to Students</Link>
      </div>
    );
  }

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto h-full">
      {/* Back link */}
      <Link href="/admin/students" className="text-sm font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1.5 transition-colors w-fit">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Back to Students
      </Link>

      {/* Student Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#fceeed] text-[#c71e22] flex items-center justify-center text-xl font-bold flex-shrink-0">
              {getInitial(student.name)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{student.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="inline-block bg-gray-100 text-gray-700 font-mono text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-200">
                  {student.studentId}
                </span>
                <span className="text-gray-400 text-sm">{student.phone}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {student.status}
                </span>
                {student.plainPassword && (
                  <span className="text-gray-500 text-sm ml-2 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    Password: {student.plainPassword}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Access Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900">Course Access</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleResetPassword}
            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl shadow-sm transition-colors font-semibold text-sm flex items-center gap-2 border border-gray-200"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            Reset Password
          </button>
          <button 
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-[#c71e22] hover:bg-[#a5191c] text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors font-semibold text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Assign Course
          </button>
        </div>
      </div>

      {/* Course Access Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
        {accessRecords.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            <p className="font-medium text-gray-500">No courses assigned yet.</p>
            <p className="text-sm text-gray-400 mt-1">Click &quot;Assign Course&quot; to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 uppercase text-xs tracking-wider font-semibold border-b border-gray-100">
                  <th className="py-3.5 px-6">Course Name</th>
                  <th className="py-3.5 px-6 text-center">Duration</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {accessRecords.map((record) => {
                  const isActive = record.status === 'active';
                  const isExpired = new Date() > new Date(record.expiryDate);
                  let displayStatus = record.status;
                  if (isActive && isExpired) displayStatus = "expired";

                  return (
                    <tr key={record._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-gray-900">
                        {record.courseId?.name || "Unknown Course"}
                      </td>
                      <td className="py-4 px-6 text-center text-gray-500 whitespace-nowrap text-sm">
                        {new Date(record.startDate).toLocaleDateString('en-GB')} 
                        <span className="mx-2 text-gray-300">→</span> 
                        <span className={isExpired ? "text-red-500 font-semibold" : ""}>{new Date(record.expiryDate).toLocaleDateString('en-GB')}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize
                          ${displayStatus === 'active' ? 'bg-green-50 text-green-600' : 
                            displayStatus === 'expired' ? 'bg-amber-50 text-amber-600' : 
                            'bg-red-50 text-red-600'}`}
                        >
                          {displayStatus}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-3 whitespace-nowrap">
                        <button 
                          onClick={() => setEditingAccess(record)}
                          className="text-[#c71e22] hover:text-[#a5191c] font-semibold text-sm"
                        >
                          {isActive && !isExpired ? 'Edit' : 'Extend'}
                        </button>
                        <button 
                          onClick={() => handleDeleteAccess(record._id)}
                          className="text-red-500 hover:text-red-700 font-semibold text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAssignModalOpen && (
        <AssignCourseModal 
          studentId={id}
          courses={courses}
          onClose={() => setIsAssignModalOpen(false)}
          onSuccess={() => { setIsAssignModalOpen(false); fetchStudentData(); }}
        />
      )}

      {editingAccess && (
        <AssignCourseModal 
          studentId={id}
          courses={courses}
          access={editingAccess}
          onClose={() => setEditingAccess(null)}
          onSuccess={() => { setEditingAccess(null); fetchStudentData(); }}
        />
      )}
    </div>
  );
}

export default function StudentDetailsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading student details...</div>}>
      <StudentDetailsContent />
    </Suspense>
  );
}

function AssignCourseModal({ studentId, courses, access, onClose, onSuccess }) {
  const [courseId, setCourseId] = useState(access?.courseId?._id || "");
  const [startDate, setStartDate] = useState(
    access ? new Date(access.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  
  const getDefaultExpiry = (start) => {
    const d = new Date(start);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const [expiryDate, setExpiryDate] = useState(
    access ? new Date(access.expiryDate).toISOString().split('T')[0] : getDefaultExpiry(new Date())
  );
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = { courseId, startDate, expiryDate };
    const url = access 
      ? `/students/${studentId}/course-access/${access._id}` 
      : `/students/${studentId}/course-access`;
    const method = access ? "PATCH" : "POST";

    try {
      const res = await fetchApi(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to save access");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">{access ? "Edit Course Access" : "Assign Course"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
          
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Course *</label>
            <select 
              required
              value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none bg-white text-sm"
            >
              <option value="" disabled>-- Select a Course --</option>
              {courses.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
              {access && !courses.find(c => c._id === access.courseId._id) && (
                <option value={access.courseId._id}>{access.courseId.name} (Archived/Inactive)</option>
              )}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Start Date *</label>
            <input 
              type="date" required
              value={startDate} 
              onChange={e => {
                setStartDate(e.target.value);
                if (new Date(e.target.value) >= new Date(expiryDate)) {
                  setExpiryDate(getDefaultExpiry(e.target.value));
                }
              }}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expiry Date *</label>
            <input 
              type="date" required
              value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              min={startDate}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[#c71e22] text-white rounded-xl hover:bg-[#a5191c] transition-colors disabled:opacity-50 font-semibold text-sm">
              {loading ? "Saving..." : "Save Access"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
