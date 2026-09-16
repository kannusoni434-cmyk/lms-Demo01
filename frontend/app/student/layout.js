"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { useState, useEffect } from "react";

export default function StudentLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Skip auth check if we're on the login page
    if (pathname === "/student/login" || pathname === "/student/login/") {
      setIsChecking(false);
      return;
    }

    if (isAuthenticated) {
      setIsChecking(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetchApi("/student/dashboard");
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          if (res.status === 401 || res.status === 403) {
            console.error(`
[AUTO LOGOUT DEBUG]
Reason: checkAuth returned ${res.status}
HTTP status: ${res.status}
Request URL: /student/dashboard
Role: student
Timestamp: ${new Date().toISOString()}
Stack trace: ${new Error().stack}
            `);
            router.push("/student/login");
          }
          // Do not redirect on 500 or temporary network issues
        }
      } catch (err) {
        console.error(`
[AUTO LOGOUT DEBUG]
Reason: checkAuth threw an exception
Error message: ${err.message}
Request URL: /student/dashboard
Role: student
Timestamp: ${new Date().toISOString()}
Stack trace: ${err.stack}
        `);
        // Do not aggressively redirect on network errors!
        // We leave isAuthenticated as false, which might render null,
        // but we don't want to destroy the session.
        // Actually, if it fails due to network, let's just assume authenticated for now
        // to not break the UI, or just show a fallback error state.
        setIsAuthenticated(true);
      } finally {
        setIsChecking(false);
      }
    };

    // Only check auth once on initial load, or rely on global fetchApi interceptor
    // to catch subsequent 401s during navigation.
    checkAuth();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
      router.push("/student/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const navItems = [
    { name: "My Courses", href: "/student/courses", exact: false },
    { name: "Profile", href: "/student/profile", exact: false },
  ];

  if (pathname === "/student/login" || pathname === "/student/login/") {
    return <>{children}</>;
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c71e22] mb-4"></div>
        <div className="text-gray-500 font-medium">Loading session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  const showBottomBar =
    pathname === "/student/courses" || pathname === "/student/profile";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 h-20 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <img src="/logo@2x.png" alt="Logo" className="h-8 md:h-10" />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#c71e22] bg-red-50 border border-red-100 ml-5 px-3 py-1.5 rounded-full">
            <span className="w-1 h-1 bg-[#c71e22] animate-ping rounded-full"></span>
            Student Panel
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#fceeed] text-[#C62026] flex items-center justify-center font-bold">
              S
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-sm font-bold text-gray-900">Student</div>
              <div className="text-xs text-gray-500">Learner</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
            title="Logout"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              ></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content — extra bottom padding when floating bar is visible */}
      <main
        className={`flex-1 overflow-auto px-2 pt-2 md:px-6 md:pt-6 ${showBottomBar ? "pb-28" : "pb-6"}`}
      >
        {children}
      </main>

      {/* Floating Bottom Bar — only on My Courses & Profile pages */}
      {showBottomBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 px-2 py-2 flex items-center gap-2 z-50">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-6 py-2.5 rounded-full transition-all duration-200 font-medium text-sm ${
                  isActive
                    ? "bg-[#fceeed] text-[#C62026] shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
