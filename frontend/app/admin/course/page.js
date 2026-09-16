"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchApi, API_URL } from "@/lib/api";
import dynamic from "next/dynamic";
import { Suspense } from "react";
const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), { ssr: false });

function CourseDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [course, setCourse] = useState(null);
  
  const getOptimizedVideoUrl = (url) => {
    if (!url) return '';
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      return url.replace('/upload/', '/upload/f_auto,q_auto/');
    }
    return url;
  };
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditVideoModalOpen, setIsEditVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState("");

  const handlePlayVideo = async (video) => {
    setPlayingVideo(video);
    if (video.hlsReady && video.storageProvider === 'r2') {
      // Use HLS route
      setPlaybackUrl(`${API_URL}/courses/${id}/videos/${video._id}/hls/master.m3u8`);
    } else if (video.storageProvider === 'r2') {
      try {
        const res = await fetchApi(`/courses/${id}/videos/${video._id}/playback-url`);
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
      setPlaybackUrl(getOptimizedVideoUrl(video.secureUrl));
    }
  };

  const fetchCourseData = async () => {
    setLoading(true);
    setError("");
    try {
      const courseRes = await fetchApi(`/courses/${id}`);
      if (!courseRes.ok) throw new Error("Failed to fetch course details");
      const courseData = await courseRes.json();
      setCourse(courseData);

      const videoRes = await fetchApi(`/courses/${id}/videos`);
      if (videoRes.ok) {
        const videoData = await videoRes.json();
        setVideos(videoData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  // Sync playingVideo if videos array updates in the background
  useEffect(() => {
    if (playingVideo) {
      const updated = videos.find((v) => v._id === playingVideo._id);
      if (updated && updated.processingStatus !== playingVideo.processingStatus) {
        setPlayingVideo(updated);
        if (updated.hlsReady && updated.storageProvider === 'r2') {
          setPlaybackUrl(`${API_URL}/courses/${id}/videos/${updated._id}/hls/master.m3u8`);
        }
      }
    }
  }, [videos, playingVideo, id]);

  // Poll for processing videos every 5 seconds
  useEffect(() => {
    const hasProcessing = videos.some((v) => v.processingStatus === 'processing');
    if (!hasProcessing) return;

    const intervalId = setInterval(async () => {
      try {
        const videoRes = await fetchApi(`/courses/${id}/videos`);
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          setVideos(videoData);
        }
      } catch (err) {
        // silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [videos, id]);

  const handleDeleteVideo = async (videoId) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      const res = await fetchApi(`/videos/${videoId}`, { method: "DELETE" });
      if (res.ok) {
        fetchCourseData();
      }
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#c71e22] mb-4"></div>
        <p className="text-gray-500 font-medium text-sm">Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <p className="text-gray-600 font-medium mb-4">{error || "Course not found"}</p>
        <Link href="/admin/courses" className="text-[#c71e22] hover:underline font-semibold text-sm">&larr; Back to Courses</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/admin/courses" className="text-sm font-medium text-gray-500 hover:text-gray-900 mb-2 inline-flex items-center gap-1.5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to Courses
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight break-words">{course.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{course.description || "Manage videos for this course"}</p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="w-full md:w-auto justify-center bg-[#c71e22] hover:bg-[#a5191c] text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors font-semibold flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          Upload Video
        </button>
      </div>

      {/* Videos List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 flex-1">
        <h2 className="text-lg font-bold text-gray-900 mb-5 border-b border-gray-100 pb-4">
          Course Videos 
          <span className="text-gray-400 font-medium ml-1">({videos.length})</span>
        </h2>
        
        {videos.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No videos found</h3>
            <p className="text-gray-400 text-sm max-w-sm">Click &quot;Upload Video&quot; to add the first video for this course.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((video, index) => {
              const thumbnailUrl = video.storageProvider === 'r2' 
                ? null 
                : (video.secureUrl ? video.secureUrl.replace(/\.[^/.]+$/, ".jpg") : "");
              
              return (
                <div key={video._id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                  <div 
                    className="relative aspect-video bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => handlePlayVideo(video)}
                  >
                    {video.storageProvider === 'r2' || !thumbnailUrl ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <svg className="w-14 h-14 text-gray-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                      </div>
                    ) : (
                      <img src={thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-11 h-11 bg-white/90 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#c71e22] uppercase tracking-wider mb-1 block">Lesson {index + 1}</span>
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{video.title}</h3>
                        <span className="text-[10px] text-gray-500 block mt-0.5">Uploaded: {new Date(video.createdAt || video.uploadedAt || Date.now()).toLocaleDateString()}</span>
                        {video.processingStatus === 'processing' ? (
                          <span className="flex items-center text-amber-500 text-xs">
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-1"></div>
                            Processing {video.processingProgress ? `(${video.processingProgress}%)` : ''}
                          </span>
                        ) : video.processingStatus === 'failed' ? (
                          <span className="text-red-500 text-xs">Failed</span>
                        ) : null}
                        {video.expiresAt && (
                           <div className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md mt-2 inline-block">Expires: {new Date(video.expiresAt).toLocaleDateString()}</div>
                        )}
                      </div>
                      <div className="flex items-center">
                        <button 
                          onClick={() => { setEditingVideo(video); setIsEditVideoModalOpen(true); }}
                          className="text-gray-400 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded-lg transition-all flex-shrink-0"
                          title="Edit video"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button 
                          onClick={() => handleDeleteVideo(video._id)}
                          className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                          title="Delete video"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isUploadModalOpen && (
        <UploadVideoModal 
          courseId={id} 
          onClose={() => setIsUploadModalOpen(false)} 
          onSuccess={() => { setIsUploadModalOpen(false); fetchCourseData(); }}
        />
      )}

      {isEditVideoModalOpen && editingVideo && (
        <EditVideoModal 
          video={editingVideo}
          onClose={() => { setIsEditVideoModalOpen(false); setEditingVideo(null); }}
          onSuccess={() => { setIsEditVideoModalOpen(false); setEditingVideo(null); fetchCourseData(); }}
        />
      )}

      {playingVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-black rounded-2xl overflow-hidden w-full max-w-4xl shadow-2xl relative flex flex-col">
            <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10">
              <button onClick={() => setPlayingVideo(null)} className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            {playingVideo.processingStatus === 'processing' ? (
              <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-gray-900 rounded-xl text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <h3 className="text-xl font-bold mb-2">Video is processing {playingVideo.processingProgress ? `(${playingVideo.processingProgress}%)` : ''}</h3>
                <p className="text-gray-400">Please wait while we prepare the video for streaming.</p>
              </div>
            ) : (
              <div className="w-full bg-black aspect-video relative flex items-center justify-center">
                <VideoPlayer 
                  src={playbackUrl} 
                  isHls={playingVideo.hlsReady && playingVideo.storageProvider === 'r2'}
                />
              </div>
            )}
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base">{playingVideo.title}</h3>
              {playingVideo.expiresAt && (
                <span className="text-xs text-gray-400">Expires: {new Date(playingVideo.expiresAt).toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CourseDetailsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading course details...</div>}>
      <CourseDetailsContent />
    </Suspense>
  );
}


function UploadVideoModal({ courseId, onClose, onSuccess }) {
  const [queue, setQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const abortControllerRef = useRef(null);
  const activeXhrs = useRef(new Set());
  const isCancelled = useRef(false);

  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  const isUploadingRef = useRef(isUploading);
  useEffect(() => { isUploadingRef.current = isUploading; }, [isUploading]);

  useEffect(() => {
    const saved = localStorage.getItem(`r2_upload_${courseId}`);
    if (saved) {
      localStorage.removeItem(`r2_upload_${courseId}`);
    }

    const handleBeforeUnload = (e) => {
      if (isUploadingRef.current) {
        e.preventDefault();
        e.returnValue = "Video upload is still in progress. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isUploadingRef.current) {
        isCancelled.current = true;
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        activeXhrs.current.forEach(xhr => xhr.abort());
        localStorage.removeItem(`r2_upload_${courseId}`);
      }
    };
  }, [courseId]);

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const newItems = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      title: file.name.replace(/\.[^/.]+$/, ""),
      status: "WAITING",
      progress: 0,
      uploadedBytes: 0,
      speed: 0,
      timeRemaining: null,
      error: ""
    }));
    
    setQueue(prev => [...prev, ...newItems]);
    setGlobalError("");
    e.target.value = null; // reset input
  };

  const removeQueueItem = (id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };
  
  const updateQueueItem = (id, updates) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleCancel = () => {
    isCancelled.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    activeXhrs.current.forEach(xhr => xhr.abort());
    activeXhrs.current.clear();
    localStorage.removeItem(`r2_upload_${courseId}`);
    
    setQueue(prev => prev.map(item => {
      if (item.status === "WAITING" || item.status === "UPLOADING" || item.status === "PROCESSING") {
        return { ...item, status: "CANCELLED" };
      }
      return item;
    }));
    setIsUploading(false);
  };

  const attemptClose = () => {
    if (isUploading) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const confirmCloseAndCancel = () => {
    handleCancel();
    onClose();
  };

  const processQueue = async () => {
    if (isUploadingRef.current) return;
    
    setIsUploading(true);
    isCancelled.current = false;
    abortControllerRef.current = new AbortController();
    
    const baseApiHost = API_URL.replace(/\/api\/?$/, "");
      
    const token = localStorage.getItem('token');
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let someCompleted = false;

    for (let i = 0; i < queueRef.current.length; i++) {
      if (isCancelled.current) break;
      
      const item = queueRef.current[i];
      if (item.status !== "WAITING") continue;
      
      updateQueueItem(item.id, { status: "UPLOADING", error: "" });
      
      try {
        const initRes = await fetch(`${baseApiHost}/api/videos/presigned-url`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            courseId,
            fileName: item.file.name,
            fileType: item.file.type || "video/mp4",
            title: item.title.trim() || item.file.name,
            size: item.file.size
          }),
          signal: abortControllerRef.current.signal
        });
        if (!initRes.ok) throw new Error("Failed to get upload URL");
        
        const { uploadUrl, objectKey, videoId } = await initRes.json();
        
        if (isCancelled.current) throw new Error("Upload cancelled");
        
        let lastUpdateTime = 0;
        let lastLoaded = 0;
        
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeXhrs.current.add(xhr);
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", item.file.type || "video/mp4");
          
          xhr.upload.onprogress = (event) => {
            if (isCancelled.current) {
              xhr.abort();
              return;
            }
            if (event.lengthComputable) {
              const now = Date.now();
              if (now - lastUpdateTime > 250) {
                const diffBytes = event.loaded - lastLoaded;
                const diffTime = (now - lastUpdateTime) / 1000;
                const speed = diffTime > 0 ? diffBytes / diffTime : 0;
                
                lastUpdateTime = now;
                lastLoaded = event.loaded;
                
                const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
                const remainingBytes = Math.max(0, event.total - event.loaded);
                const etaSeconds = speed > 0 ? remainingBytes / speed : 0;
                
                updateQueueItem(item.id, {
                  uploadedBytes: event.loaded,
                  progress,
                  speed,
                  timeRemaining: etaSeconds
                });
              }
            }
          };
          
          xhr.onload = () => {
            activeXhrs.current.delete(xhr);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`HTTP ${xhr.status} ${xhr.statusText}`));
            }
          };
          
          xhr.onerror = () => {
            activeXhrs.current.delete(xhr);
            reject(new Error("Network error"));
          };
          
          xhr.onabort = () => {
            activeXhrs.current.delete(xhr);
            reject(new Error("Upload cancelled"));
          };
          
          xhr.send(item.file);
        });
        
        if (isCancelled.current) throw new Error("Upload cancelled");
        
        updateQueueItem(item.id, {
          uploadedBytes: item.file.size,
          progress: 100,
          timeRemaining: 0,
          status: "PROCESSING"
        });
        
        const saveRes = await fetch(`${baseApiHost}/api/videos/upload-complete`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ videoId, objectKey }),
          signal: abortControllerRef.current.signal
        });

        if (!saveRes.ok) {
          const errorData = await saveRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to save video metadata");
        }
        
        updateQueueItem(item.id, { status: "COMPLETED" });
        someCompleted = true;
        
      } catch (err) {
        if (isCancelled.current || err.message === "Upload cancelled" || err.name === 'AbortError') {
           updateQueueItem(item.id, { status: "CANCELLED" });
        } else {
           console.error(err);
           updateQueueItem(item.id, { status: "FAILED", error: err.message || "An unexpected error occurred" });
        }
      }
    }
    
    setIsUploading(false);
    if (someCompleted) {
      onSuccess();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (queue.length === 0) {
      setGlobalError("Please select at least one video file");
      return;
    }
    if (queue.some(q => !q.title.trim())) {
      setGlobalError("Please provide a title for all videos");
      return;
    }
    
    setGlobalError("");
    processQueue();
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return "Calculating...";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        {showConfirmClose && (
          <div className="absolute inset-0 bg-white/95 z-50 flex items-center justify-center p-8 text-center flex-col backdrop-blur-sm rounded-2xl">
             <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
               <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
             </div>
             <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel video upload?</h3>
             <p className="text-gray-500 text-sm mb-6">The current upload queue will be aborted and you will lose your progress.</p>
             <div className="flex flex-col md:flex-row gap-3 w-full max-w-sm mx-auto">
               <button onClick={() => setShowConfirmClose(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm">
                 Continue Upload
               </button>
               <button onClick={confirmCloseAndCancel} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-sm">
                 Cancel Upload
               </button>
             </div>
          </div>
        )}

        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Upload Videos</h2>
          <button onClick={attemptClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
            {globalError && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl font-medium border border-red-100">{globalError}</div>}
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Video Files *</label>
              <div className={`border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden`}>
                <input 
                  type="file" multiple accept="video/mp4,video/x-m4v,video/*"
                  onChange={handleFilesSelected}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <svg className="w-7 h-7 mx-auto mb-2 text-[#c71e22]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <div className="text-sm font-semibold text-gray-900">
                  Click to browse or drag files here
                </div>
                <div className="text-xs text-gray-400 mt-1">MP4, WebM, MOV (Multiple files supported)</div>
              </div>
            </div>

            {queue.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2">Upload Queue ({queue.length})</h3>
                {queue.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                    {(item.status === "UPLOADING" || item.status === "PROCESSING" || item.status === "COMPLETED") && item.progress > 0 && (
                      <div 
                        className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ${item.status === "FAILED" ? "bg-red-500" : item.status === "COMPLETED" ? "bg-green-500" : "bg-[#c71e22]"}`} 
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    )}
                    
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Video Title</label>
                        <input 
                          type="text" required
                          value={item.title} onChange={e => updateQueueItem(item.id, { title: e.target.value })}
                          disabled={item.status !== "WAITING" && item.status !== "FAILED" && item.status !== "CANCELLED"}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Video title"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeQueueItem(item.id)}
                        disabled={item.status === "UPLOADING" || item.status === "PROCESSING"}
                        className="mt-5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                      <div className="flex items-center justify-between">
                        <span>
                          {item.status === "WAITING" && "Waiting in queue..."}
                          {item.status === "UPLOADING" && "Uploading to R2..."}
                          {item.status === "PROCESSING" && "Saving metadata..."}
                          {item.status === "COMPLETED" && "Upload complete!"}
                          {item.status === "FAILED" && "Upload failed"}
                          {item.status === "CANCELLED" && "Upload cancelled"}
                        </span>
                        {(item.status === "UPLOADING" || item.status === "PROCESSING" || item.status === "COMPLETED") && (
                          <span className={item.status === "COMPLETED" ? "text-green-600" : "text-[#c71e22]"}>{item.progress}%</span>
                        )}
                      </div>
                      
                      {item.error && (
                        <div className="text-red-500 text-[11px] mt-0.5">{item.error}</div>
                      )}

                      {item.status === "UPLOADING" && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between text-gray-500 mt-1">
                          <span>{formatBytes(item.uploadedBytes)} / {formatBytes(item.file.size)}</span>
                          <span>{formatBytes(item.speed)}/s • ETA: {formatTime(item.timeRemaining)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <button 
              type="button" 
              onClick={attemptClose} 
              className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {isUploading ? "Cancel All" : "Close"}
            </button>
            <button 
              type="submit" 
              disabled={isUploading || queue.length === 0 || queue.every(q => q.status === "COMPLETED" || q.status === "PROCESSING")} 
              className="px-5 py-2.5 bg-[#c71e22] text-white font-semibold rounded-xl hover:bg-[#a5191c] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : "Start Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditVideoModal({ video, onClose, onSuccess }) {
  const [title, setTitle] = useState(video?.title || "");
  const [description, setDescription] = useState(video?.description || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetchApi(`/videos/${video._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to update video");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Edit Video</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Video Title *</label>
            <input 
              type="text" required
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm"
              placeholder="Enter video title"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
            <textarea 
              rows="4"
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-red-100 focus:border-red-300 focus:outline-none text-sm resize-none"
              placeholder="Brief description of the video"
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
