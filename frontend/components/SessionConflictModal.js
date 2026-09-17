"use client";

import { useEffect, useState } from "react";

export default function SessionConflictModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleConflict = () => {
      setIsOpen(true);
    };

    window.addEventListener("session_conflict", handleConflict);

    return () => {
      window.removeEventListener("session_conflict", handleConflict);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    
    // Determine if admin or student based on path
    const isStudent = window.location.pathname.startsWith("/student");
    const targetLogin = isStudent ? "/student/login" : "/admin/login";
    
    window.location.href = targetLogin;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-gray-600 mb-6">
            Your account has been logged in on another device. You are being logged out of this session.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-[#c71e22] hover:bg-[#a5191c] text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
}
