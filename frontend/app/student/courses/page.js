"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";

export default function MyCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [greeting, setGreeting] = useState("");

  const greetings = [
    "Keep pushing forward",
    "Time to learn something new",
    "You're doing great",
    "Let's conquer today",
    "Another day, another skill",
    "Embrace the challenge"
  ];

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    
    const fetchData = async () => {
      try {
        const [coursesRes, dashboardRes] = await Promise.all([
          fetchApi("/student/courses"),
          fetchApi("/student/dashboard")
        ]);

        if (!coursesRes.ok || !dashboardRes.ok) {
          throw new Error("Failed to load your courses");
        }
        
        const coursesData = await coursesRes.json();
        const dashboardJson = await dashboardRes.json();
        
        setCourses(coursesData);
        setDashboardData(dashboardJson);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex items-center justify-center">
        <div className="text-gray-500 font-medium">Loading your courses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto text-center py-10 md:py-20">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block font-medium border border-red-100">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto h-full px-1">
      {/* Welcome Banner */}
      <div className="bg-[#fceeed] rounded-[20px] p-5 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden mt-4 md:mt-8">
        <div className="absolute right-20 -bottom-10 w-32 h-32 bg-red-200/40 rounded-full blur-xl"></div>
        
        <div className="relative z-10 flex items-center gap-4 w-full">
          <div className="w-14 h-14 bg-white/70 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white">
            <svg className="w-7 h-7 text-[#c71e22]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 tracking-tight">{greeting}, {dashboardData?.name}!</h2>
            <p className="text-gray-600 max-w-lg text-sm sm:text-base">
              Ready to continue learning? You have <strong className="text-[#c71e22]">{courses.length}</strong> assigned courses available.
            </p>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-4 sm:p-6 md:p-12 text-center flex flex-col items-center justify-center h-[50vh]">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active Courses</h3>
          <p className="text-gray-500 max-w-md">
            You don&apos;t have any active courses yet. If you believe this is an error, please contact your administrator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course) => {
            const isWebCourse = course.name.toLowerCase().includes('web');
            const expiry = new Date(course.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            
            return (
              <Link 
                href={`/student/course?id=${course._id}`}
                key={course._id} 
                className={`bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow group relative cursor-pointer block ${course.status === 'inactive' ? 'grayscale opacity-80' : ''}`}
              >
                
                {/* Status badge */}
                {course.status === 'inactive' && (
                  <div className="absolute top-4 left-4 z-20">
                    <span className="inline-block px-2.5 py-1 bg-gray-500/90 text-white border border-gray-600/20 rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm backdrop-blur-sm">
                      Inactive
                    </span>
                  </div>
                )}

                {/* Visual Thumbnail Area */}
                <div className={`aspect-video w-full relative overflow-hidden flex flex-col justify-end ${
                  isWebCourse && !course.thumbnail ? 'bg-[#fcf3cc]' : !course.thumbnail ? 'bg-[#d2e7fe]' : 'bg-gray-100'
                }`}>
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    /* Decorative Elements */
                    <div className="absolute inset-0 flex items-center justify-center text-black/5">
                      <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                        {isWebCourse 
                          ? <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          : <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        }
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content & Action Area */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2 break-words group-hover:text-[#c71e22] transition-colors">{course.name}</h3>
                  {course.description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                  <div className="text-sm font-medium text-gray-500 flex items-center gap-1.5 mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    {course.videoCount || 0} Videos
                  </div>
                  <div className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-xl inline-block w-fit max-w-full break-words mb-4">
                    Valid until {expiry}
                  </div>
                  
                  <div className="mt-auto">
                    <div 
                      className="block w-full text-center bg-gray-50 group-hover:bg-[#c71e22] text-gray-700 group-hover:text-white font-semibold py-2.5 rounded-xl transition-colors border border-gray-200 group-hover:border-[#c71e22]"
                    >
                      Continue Learning
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
