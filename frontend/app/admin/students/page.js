"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState(false);
  
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newCredentials, setNewCredentials] = useState(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetchApi("/students");
      if (!res.ok) throw new Error("Failed to fetch students");
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch students", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "blocked" : "active";
    try {
      const res = await fetchApi(`/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch (error) {
      console.error("Failed to toggle status", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    try {
      const res = await fetchApi(`/students/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch (error) {
      console.error("Failed to delete student", error);
    }
  };

  const handleAddSuccess = (credentials) => {
    setIsAddModalOpen(false);
    setNewCredentials(credentials);
    setIsCredsModalOpen(true);
    fetchStudents();
  };

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const avatarColors = [
    'bg-red-100 text-red-600',
    'bg-blue-100 text-blue-600',
    'bg-green-100 text-green-600',
    'bg-purple-100 text-purple-600',
    'bg-amber-100 text-amber-600',
    'bg-pink-100 text-pink-600',
  ];

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.studentId.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  return (
    <div className="flex flex-col gap-5 mx-auto h-full">
      {/* Top Banner */}
      <div className="bg-[#fceeed] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/60 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[#c71e22]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Students</h2>
            <p className="text-gray-500 text-sm">Manage and control student accounts</p>
          </div>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#c71e22] hover:bg-[#a5191c] text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors font-semibold flex items-center justify-center gap-2 text-sm w-full sm:w-auto flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Add students
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-96">
        <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input 
          type="text" 
          placeholder="Search students by name, ID or phone..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 text-sm font-medium placeholder-gray-400 shadow-sm" 
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-y-auto border border-gray-100 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#fceeed]/60 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3.5 px-5 w-12">#</th>
                <th className="py-3.5 px-5">Students name</th>
                <th className="py-3.5 px-5">Students ID</th>
                <th className="py-3.5 px-5">Phone / E-Mail</th>
                <th className="py-3.5 px-5">Joined on</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-[#c71e22]"></div>
                      <span>Loading students...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-gray-400">
                    {search ? 'No students match your search.' : 'No students found.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => (
                <tr key={student._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-5 text-gray-400 font-medium">{index + 1}.</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColors[index % avatarColors.length]}`}>
                        {getInitial(student.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-400">{student.assignedCourses?.length || 0} courses assigned</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className="inline-block bg-gray-100 text-gray-700 font-mono text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-200">
                      {student.studentId}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-gray-600">{student.phone}</td>
                  <td className="py-4 px-5 text-gray-500">{new Date(student.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  <td className="py-4 px-5">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${student.status === 'active' ? 'bg-[#e2f5ea] text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/admin/student?id=${student._id}`} title="View Details" className="p-1.5 text-gray-400 hover:text-[#c71e22] hover:bg-red-50 rounded-lg transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </Link>
                      <button onClick={() => { setSelectedStudent(student); setIsEditModalOpen(true); }} title="Edit" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>
                      <button onClick={() => handleDelete(student._id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <AddStudentModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={handleAddSuccess} 
        />
      )}

      {isEditModalOpen && selectedStudent && (
        <EditStudentModal 
          student={selectedStudent} 
          onClose={() => setIsEditModalOpen(false)} 
          onSuccess={() => { setIsEditModalOpen(false); fetchStudents(); }} 
        />
      )}

      {isCredsModalOpen && newCredentials && (
        <CredentialsModal 
          credentials={newCredentials} 
          onClose={() => setIsCredsModalOpen(false)} 
        />
      )}
    </div>
  );
}

function AddStudentModal({ onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetchApi("/courses");
        if (res.ok) {
          const data = await res.json();
          setAvailableCourses(data.filter(c => c.status === "active"));
        }
      } catch (err) {
        console.error("Failed to fetch courses for assignment", err);
      }
    };
    fetchCourses();
  }, []);

  const handleCourseToggle = (courseId) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { name, phone };
      if (password) payload.password = password;
      if (selectedCourses.length > 0) payload.courseIds = selectedCourses;

      const res = await fetchApi("/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
      } else {
        setError(data.error || "Failed to create student");
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Add New Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name *</label>
            <input 
              type="text" required
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
              placeholder="John Doe"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number *</label>
            <input 
              type="text" required
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
              placeholder="Enter 10-digit phone number"
              pattern="[0-9]{10}"
              maxLength={10}
              minLength={10}
              title="Phone number must be exactly 10 digits"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Manual Password (Optional)</label>
            <input 
              type="text" 
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
              placeholder="Leave blank to auto-generate"
            />
          </div>
          
          {availableCourses.length > 0 && (
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assign Courses (Optional)</label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-2">
                {availableCourses.map(course => (
                  <label key={course._id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                    <input 
                      type="checkbox" 
                      checked={selectedCourses.includes(course._id)}
                      onChange={() => handleCourseToggle(course._id)}
                      className="w-4 h-4 text-[#c71e22] bg-white border-gray-300 rounded focus:ring-[#c71e22] focus:ring-2"
                    />
                    <span className="text-sm font-medium text-gray-700 select-none">{course.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Selected courses will be granted 1-year access.</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[#c71e22] text-white rounded-xl hover:bg-[#a5191c] transition-colors disabled:opacity-50 font-semibold text-sm">
              {loading ? "Creating..." : "Save Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStudentModal({ student, onClose, onSuccess }) {
  const [name, setName] = useState(student.name);
  const [phone, setPhone] = useState(student.phone);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { name, phone };
      if (password) payload.password = password;

      const res = await fetchApi(`/students/${student._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to update student");
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name *</label>
            <input 
              type="text" required
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number *</label>
            <input 
              type="text" required
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
              placeholder="Enter 10-digit phone number"
              pattern="[0-9]{10}"
              maxLength={10}
              minLength={10}
              title="Phone number must be exactly 10 digits"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reset Password (Optional)</label>
            <input 
              type="text" 
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
              placeholder="Leave blank to keep current"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[#c71e22] text-white rounded-xl hover:bg-[#a5191c] transition-colors disabled:opacity-50 font-semibold text-sm">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialsModal({ credentials, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Student Created!</h2>
          <p className="text-gray-500 text-sm mb-6">Please securely share these credentials with the student. They will not be shown again.</p>
          
          <div className="bg-gray-50 p-5 rounded-xl text-left mb-6 border border-gray-100">
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Student ID</label>
              <div className="font-mono text-lg text-gray-900 select-all font-semibold">{credentials.studentId}</div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Password</label>
              <div className="font-mono text-lg text-gray-900 select-all font-semibold">{credentials.password}</div>
            </div>
          </div>

          <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
