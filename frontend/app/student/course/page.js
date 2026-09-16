"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchApi, API_URL } from "@/lib/api";
import dynamic from "next/dynamic";
const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), { ssr: false });
import { Suspense } from "react";

function StudentCourseDetailsContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('id');
  const [course, setCourse] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingVideo, setPlayingVideo] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const videoRef = useRef(null);
  const currentTimeRef = useRef(0);

  const getOptimizedVideoUrl = (url) => {
    if (!url) return "";
    if (url.includes("cloudinary.com") && url.includes("/upload/")) {
      return url.replace("/upload/", `/upload/f_auto,q_auto/`);
    }
    return url;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayVideo = async (video) => {
    setPlayingVideo(video);
    currentTimeRef.current = 0;
    if (video.hlsReady && video.storageProvider === 'r2') {
      // It's a new HLS video
      setPlaybackUrl(`${API_URL}/courses/${courseId}/videos/${video._id}/hls/master.m3u8`);
    } else if (video.storageProvider === 'r2') {
      // Old standard mp4 video
      try {
        const res = await fetchApi(
          `/courses/${courseId}/videos/${video._id}/playback-url`,
        );
        if (res.ok) {
          const data = await res.json();
          setPlaybackUrl(data.url);
        } else {
          setError("Failed to get playback URL");
        }
      } catch (err) {
        setError(err.message);
      }
    } else {
      setPlaybackUrl(getOptimizedVideoUrl(video.secureUrl, "auto"));
    }
  };

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        // Fetch dashboard data in parallel to get studentId
        const dashResPromise = fetchApi("/student/dashboard");

        // Fetch course details
        const courseRes = await fetchApi(`/student/courses/${courseId}`);
        if (!courseRes.ok) {
          if (courseRes.status === 401) throw new Error("Please log in again.");
          if (courseRes.status === 403) {
            const data = await courseRes.json();
            if (data.error === "ACCESS_EXPIRED")
              throw new Error("This course access has expired.");
            if (data.error === "ACCESS_REVOKED")
              throw new Error("This course access is no longer available.");
            throw new Error("You do not have access to this course.");
          }
          throw new Error("Failed to load course details.");
        }

        const courseData = await courseRes.json();
        setCourse(courseData);

        // Fetch videos ONLY if course access is granted
        const videoRes = await fetchApi(`/student/courses/${courseId}/videos`);
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          setVideos(videoData);
          if (videoData.length > 0) {
            handlePlayVideo(videoData[0]);
          }
        }

        const dashRes = await dashResPromise;
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setDashboardData(dashData);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Sync playingVideo if videos array updates in the background
  useEffect(() => {
    if (playingVideo) {
      const updated = videos.find((v) => v._id === playingVideo._id);
      if (updated && updated.processingStatus !== playingVideo.processingStatus) {
        setPlayingVideo(updated);
        if (updated.hlsReady && updated.storageProvider === 'r2') {
          setPlaybackUrl(`${API_URL}/courses/${courseId}/videos/${updated._id}/hls/master.m3u8`);
        }
      }
    }
  }, [videos, playingVideo, courseId]);

  // Poll for processing videos every 5 seconds
  useEffect(() => {
    const hasProcessing = videos.some((v) => v.processingStatus === 'processing');
    if (!hasProcessing) return;

    const intervalId = setInterval(async () => {
      try {
        const videoRes = await fetchApi(`/student/courses/${courseId}/videos`);
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          setVideos(videoData);
        }
      } catch (err) {
        // silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [videos, courseId]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c71e22] mb-4"></div>
        <div className="text-gray-500 font-medium">
          Loading course material...
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center h-full py-10 md:py-20">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-md w-full text-center border border-red-100 shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="font-medium text-red-500 mb-6">{error}</p>
          <Link
            href="/student/courses"
            className="inline-block bg-white text-red-600 border border-red-200 px-6 py-2.5 rounded-xl font-semibold hover:bg-red-50 transition-colors"
          >
            Back to My Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1400px] mx-auto h-full px-4 sm:px-6 md:px-8 py-6">
      {/* Banner */}
      <div className="bg-[#fceeed] rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-red-100">
        <div className="flex items-start gap-3 text-red-900">
          <svg
            className="w-6 h-6 mt-0.5 flex-shrink-0 text-red-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            ></path>
          </svg>
          <p className="text-sm md:text-base font-medium leading-relaxed">
            <span className="font-bold text-[#c71e22]">
              Offline Enrolled Portal:
            </span>{" "}
            You are viewing courses registered via the Jains Computer
            administrative office. Subscriptions and credentials are managed
            directly at the office desk.
          </p>
        </div>
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm border border-red-200">
          Student ID: {dashboardData?.studentId || "..."}
        </div>
      </div>

      {/* Breadcrumb & Back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 flex-wrap">
          <Link
            href="/student/courses"
            className="hover:text-gray-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm transition-all"
          >
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              ></path>
            </svg>
            My Courses
          </Link>
          <span className="text-gray-300">›</span>
          <span className="text-gray-600">Learning Activity</span>
          <span className="text-gray-300">›</span>
          <span className="text-[#c71e22] bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
            {course.name}
          </span>
        </div>

        <Link
          href="/student/courses"
          className="text-sm font-bold text-gray-600 hover:text-[#c71e22] bg-white border border-gray-200 hover:border-red-200 px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
          Back to Enrolled Courses
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Video Player & Details */}
        <div className="flex-1 w-full flex flex-col gap-6">
          <div className="bg-black rounded-2xl overflow-hidden shadow-lg aspect-video relative flex items-center justify-center border border-gray-200">
            {playingVideo ? (
              playingVideo.processingStatus === 'processing' ? (
                <div className="text-white flex flex-col items-center p-6 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c71e22] mx-auto mb-4"></div>
                  <h3 className="text-xl font-bold mb-2">Video is processing</h3>
                  <p className="text-gray-400">Please check back in a few minutes.</p>
                </div>
              ) : playingVideo.hlsReady ? (
                <div className="w-full h-full bg-black">
                  <VideoPlayer 
                    src={playbackUrl} 
                    isHls={true} 
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-black">
                  <VideoPlayer 
                    src={playbackUrl} 
                    isHls={false} 
                  />
                </div>
              )
            ) : (
              <div className="text-white flex flex-col items-center p-6 text-center">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-10 h-10 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    ></path>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">No Video Selected</h3>
                <p className="text-gray-400 max-w-md">
                  Select a lesson from the course syllabus on the right to start
                  learning.
                </p>
              </div>
            )}
          </div>

          {/* Course Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 border-b border-gray-100 pb-8">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 leading-tight">
                  {course.name}
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                  <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                    <svg
                      className="w-4 h-4 text-[#c71e22]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    {videos.length} Lessons
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Video Description
                </h3>
                {(playingVideo?.expiresAt || course?.expiryDate) && (
                  <span className="bg-amber-50 text-amber-600 text-sm font-bold px-3 py-1 rounded-lg border border-amber-100 flex items-center gap-1.5 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Valid until: {new Date(playingVideo?.expiresAt || course?.expiryDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="prose prose-red max-w-none text-gray-600 leading-relaxed">
                {playingVideo?.description ? (
                  playingVideo.description.split("\n").map((paragraph, idx) => (
                    <p key={idx} className="mb-4">
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="italic text-gray-400">
                    No description available for this video.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Playlist Sidebar */}
        <div className="w-full lg:w-[380px] xl:w-[420px] bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full lg:max-h-[850px] overflow-hidden sticky top-6">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
            <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[#c71e22]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
              Course Lessons ({videos.length})
            </h2>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-lg border border-green-200 uppercase tracking-wide">
              Enrolled
            </span>
          </div>

          <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-2 custom-scrollbar">
            {videos.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    ></path>
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">
                  No lessons uploaded yet.
                </p>
              </div>
            ) : (
              videos.map((video, index) => {
                const isActive = playingVideo && playingVideo._id === video._id;
                return (
                  <div
                    key={video._id}
                    onClick={() => handlePlayVideo(video)}
                    className={`flex items-start gap-4 p-3.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive ? "bg-red-50 border border-red-100 shadow-sm" : "hover:bg-gray-50 border border-transparent"}`}
                  >
                    <div
                      className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm transition-colors ${isActive ? "bg-[#c71e22] text-white" : "bg-white border border-gray-200 text-gray-500"}`}
                    >
                      {isActive ? (
                        <svg
                          className="w-6 h-6 ml-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h4
                        className={`font-semibold truncate text-base leading-tight mb-1.5 ${isActive ? "text-[#c71e22]" : "text-gray-900 group-hover:text-[#c71e22]"}`}
                      >
                        {video.title}
                      </h4>
                      {video.processingStatus === 'processing' && (
                        <span className="inline-block mt-1 mb-1 text-[10px] font-semibold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Processing Video...</span>
                      )}
                      {(video.expiresAt || course?.expiryDate) && (
                        <div className="text-[10px] text-amber-600 font-bold mb-1.5 flex items-center gap-1">
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                           Expires: {new Date(video.expiresAt || course?.expiryDate).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <span className="text-xs font-bold bg-[#c71e22] text-white px-2 py-0.5 rounded flex items-center gap-1 shadow-sm uppercase tracking-wide">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              ></path>
                            </svg>
                            Now Playing
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Video Lesson
                          </span>
                        )}
                        {video.duration > 0 && (
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentCourseDetailsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading course...</div>}>
      <StudentCourseDetailsContent />
    </Suspense>
  );
}
