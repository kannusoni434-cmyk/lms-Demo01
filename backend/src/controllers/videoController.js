import Video from "../models/Video.js";
import Course from "../models/Course.js";
import { cloudinary } from "../config/cloudinary.js";
import { r2Client } from "../config/r2.js";
import { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, AbortMultipartUploadCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { hasCourseAccess } from "../services/courseAccessService.js";
import { videoQueue } from "../config/queue.js";

// Generate upload signature for direct Cloudinary chunked upload
export const generateSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "lms-videos";
    
    // Create signature using cloudinary utils
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      chunkSize: parseInt(process.env.CLOUDINARY_UPLOAD_CHUNK_SIZE) || 20971520 // Default 20MB
    });
  } catch (error) {
    console.error("Generate signature error:", error);
    res.status(500).json({ error: "Failed to generate upload signature" });
  }
};

// Create video record after direct Cloudinary upload
export const uploadVideo = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log(`[DEBUG] uploadVideo called for course ${courseId}`);
    // The video binary is uploaded directly to Cloudinary by the browser.
    // The frontend sends only the resulting metadata here.
    const { title, description, publicId, secureUrl, duration } = req.body;

    if (!publicId || !secureUrl) {
      return res.status(400).json({ error: "Video metadata missing" });
    }

    // Check if course exists
    let course;
    try {
      course = await Course.findById(courseId);
    } catch (e) {
      // Invalid ObjectId
    }

    if (!course) {
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "video" }).catch(() => {});
      }
      return res.status(404).json({ error: "Course not found" });
    }

    // Determine order
    const videoCount = await Video.countDocuments({ courseId });
    const order = videoCount + 1;

    const video = new Video({
      courseId,
      title: title || "Untitled Video",
      description: description || "",
      publicId: publicId,
      secureUrl: secureUrl,
      duration: duration || 0,
      order,
    });

    await video.save();

    res.status(201).json(video);
  } catch (error) {
    console.error("Upload video DB save error:", error.message || error);
    
    // Clean up Cloudinary upload if MongoDB DB save failed
    if (req.body && req.body.publicId) {
      await cloudinary.uploader.destroy(req.body.publicId, { resource_type: "video" }).catch(() => {});
    }
    
    res.status(500).json({ error: "Database save failed" });
  }
};

// Get all videos for a course
export const getCourseVideos = async (req, res) => {
  try {
    const { courseId } = req.params;
    const videos = await Video.find({ courseId }).sort({ createdAt: -1 });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Get course videos error:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};

// Delete a video
export const updateVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { title, description } = req.body;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;

    await video.save();

    res.status(200).json(video);
  } catch (error) {
    console.error("Update video error:", error);
    res.status(500).json({ error: "Failed to update video" });
  }
};

export const deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Delete from storage
    if (video.storageProvider === "r2" && video.objectKey) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: video.objectKey,
        });
        await r2Client.send(command);
      } catch (r2Err) {
        console.error("Failed to delete R2 object:", r2Err);
        return res.status(500).json({ error: "Failed to delete from storage" });
      }
    } else if (video.publicId) {
      await cloudinary.uploader.destroy(video.publicId, { resource_type: "video" });
    }

    // Delete from DB
    await Video.findByIdAndDelete(videoId);

    // Reorder remaining videos
    const remainingVideos = await Video.find({ courseId: video.courseId }).sort({ createdAt: -1 });
    for (let i = 0; i < remainingVideos.length; i++) {
      remainingVideos[i].order = i + 1;
      await remainingVideos[i].save();
    }

    res.status(200).json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
};

// Initiate R2 Multipart Upload
export const initiateMultipartUpload = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { filename, parts } = req.body;
    
    if (!parts || parts <= 0 || parts > 10000) {
      return res.status(400).json({ error: "Invalid parts count" });
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uuid = crypto.randomUUID();
    const objectKey = `videos/${courseId}/${uuid}-${sanitizedFilename}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
    });

    const multipartUpload = await r2Client.send(command);
    const uploadId = multipartUpload.UploadId;

    const presignedUrls = await Promise.all(
      Array.from({ length: parts }).map(async (_, index) => {
        const i = index + 1;
        const partCommand = new UploadPartCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: objectKey,
          UploadId: uploadId,
          PartNumber: i,
        });
        const url = await getSignedUrl(r2Client, partCommand, { expiresIn: 3600 });
        return { partNumber: i, url };
      })
    );

    res.status(200).json({ uploadId, objectKey, presignedUrls });
  } catch (error) {
    console.error("Initiate multipart error:", error);
    res.status(500).json({ error: "Failed to initiate multipart upload" });
  }
};

// Complete R2 Multipart Upload
export const completeMultipartUpload = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log(`[PROCESS] UPLOAD_RECEIVED for course ${courseId}`);
    const { uploadId, objectKey, parts, title, description, size, mimeType, originalName } = req.body;

    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }, // array of { ETag, PartNumber }
    });

    console.log(`[PROCESS] R2_UPLOAD_STARTED`);
    await r2Client.send(command);
    console.log(`[PROCESS] R2_UPLOAD_COMPLETED`);

    const videoCount = await Video.countDocuments({ courseId });
    const order = videoCount + 1;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days exact

    const video = new Video({
      courseId,
      title: title || "Untitled Video",
      description: description || "",
      storageProvider: "r2",
      objectKey,
      originalName,
      mimeType,
      size,
      expiresAt,
      uploadedAt: now,
      order,
      processingStatus: "processing",
    });

    await video.save();
    console.log(`[PROCESS] VIDEO_DB_CREATED videoId=${video._id}`);

    // Queue for HLS processing
    await videoQueue.add('process-video', { videoId: video._id.toString() });

    res.status(200).json(video);
  } catch (error) {
    console.error("[PROCESS][ERROR] Complete multipart error:", error.message);
    res.status(500).json({ error: "Failed to complete multipart upload" });
  }
};

// Abort R2 Multipart Upload
export const abortMultipartUpload = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { uploadId, objectKey } = req.body;

    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      UploadId: uploadId,
    });

    await r2Client.send(command);
    res.status(200).json({ message: "Multipart upload aborted" });
  } catch (error) {
    console.error("Abort multipart error:", error);
    res.status(500).json({ error: "Failed to abort multipart upload" });
  }
};

// Generate Direct Upload Presigned URL
export const getDirectUploadUrl = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { filename, contentType } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uuid = crypto.randomUUID();
    const objectKey = `videos/${courseId}/${uuid}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType || "video/mp4",
    });

    // 1 hour expiration for the upload URL
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    res.status(200).json({ uploadUrl, objectKey });
  } catch (error) {
    console.error("Get direct upload URL error:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

// Complete Direct Upload
export const completeDirectUpload = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { objectKey, title, description, size, mimeType, originalName } = req.body;

    console.log(`[PROCESS] DIRECT_UPLOAD_COMPLETED for course ${courseId}`);

    const videoCount = await Video.countDocuments({ courseId });
    const order = videoCount + 1;
    const now = new Date();
    // Keep 7 days expiration for direct uploads before they are converted to HLS
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const video = new Video({
      courseId,
      title: title || "Untitled Video",
      description: description || "",
      storageProvider: "r2",
      objectKey,
      originalName,
      mimeType,
      size,
      expiresAt,
      uploadedAt: now,
      order,
      processingStatus: "processing",
    });

    await video.save();
    console.log(`[PROCESS] QUEUING_VIDEO ${video._id}`);
    // Fire and forget
    await videoQueue.add('process-video', { videoId: video._id.toString() });

    res.status(200).json({ message: "Upload completed and queued for processing", video });
  } catch (error) {
    console.error("Complete direct upload error:", error);
    res.status(500).json({ error: error.message || "Failed to finalize upload" });
  }
};

// Get secure playback URL
export const getPlaybackUrl = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const user = req.user;

    if (user.role === "student") {
      const accessCheck = await hasCourseAccess(user.userId, courseId);
      if (!accessCheck.hasAccess) {
        return res.status(403).json({ error: "Access denied to this course" });
      }
    } else if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized role" });
    }

    const video = await Video.findOne({ _id: videoId, courseId });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.storageProvider !== "r2") {
      return res.status(400).json({ error: "Video is not stored in R2" });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: video.objectKey,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.status(200).json({ url });
  } catch (error) {
    console.error("Get playback URL error:", error);
    res.status(500).json({ error: "Failed to generate playback URL" });
  }
};

// Get HLS Master Playlist
export const getHlsMasterPlaylist = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const user = req.user;
    
    if (user.role === "student") {
      const accessCheck = await hasCourseAccess(user.userId, courseId);
      if (!accessCheck.hasAccess) return res.status(403).json({ error: "Access denied" });
    } else if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized role" });
    }

    const video = await Video.findOne({ _id: videoId, courseId });
    if (!video || !video.hlsReady || !video.hlsMasterPlaylist) {
      return res.status(404).json({ error: "HLS not ready or found" });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: video.hlsMasterPlaylist,
    });
    const response = await r2Client.send(command);
    let masterPlaylistContent = await response.Body.transformToString();
    
    const apiBase = process.env.API_BASE_URL || 'https://lmsbackend.jainscomputer.com/api';
    const hlsBase = `${apiBase}/courses/${courseId}/videos/${videoId}/hls`;
    const tokenQuery = req.query.token ? `?token=${req.query.token}` : '';
    masterPlaylistContent = masterPlaylistContent.replace(/([a-zA-Z0-9_-]+\.m3u8)/g, `${hlsBase}/$1${tokenQuery}`);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(masterPlaylistContent);
  } catch (error) {
    console.error("Get HLS master error:", error);
    res.status(500).json({ error: "Failed to generate master playlist" });
  }
};

// Get HLS Variant Playlist
export const getHlsVariantPlaylist = async (req, res) => {
  try {
    const { courseId, videoId, rendition } = req.params;
    const user = req.user;
    
    if (user.role === "student") {
      const accessCheck = await hasCourseAccess(user.userId, courseId);
      if (!accessCheck.hasAccess) return res.status(403).json({ error: "Access denied" });
    } else if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized role" });
    }

    const video = await Video.findOne({ _id: videoId, courseId });
    if (!video || !video.hlsReady) return res.status(404).json({ error: "HLS not ready" });

    const variantKey = `videos/${courseId}/${videoId}/hls/${rendition}`;
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: variantKey,
    });
    
    const response = await r2Client.send(command);
    let playlistContent = await response.Body.transformToString();

    const lines = playlistContent.split('\n');
    const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN;
    
    if (!r2PublicDomain) {
      console.warn("R2_PUBLIC_DOMAIN is not set in environment variables. Segment playback might fail if not fully configured.");
    }
    
    const transformedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Use public domain for fast segment loading instead of generating individual presigned URLs
        return `${r2PublicDomain}/videos/${courseId}/${videoId}/hls/${trimmed}`;
      }
      return line;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send(transformedLines.join('\n'));
  } catch (error) {
    console.error("Get HLS variant error:", error);
    res.status(500).json({ error: "Failed to generate variant playlist" });
  }
};

// Generate Presigned URL for Direct Upload
export const generatePresignedUrl = async (req, res) => {
  try {
    const { courseId, fileName, fileType, title, size } = req.body;
    
    if (!fileName || !courseId) {
      return res.status(400).json({ error: "fileName and courseId are required" });
    }

    const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uuid = crypto.randomUUID();
    const objectKey = `videos/${courseId}/${uuid}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: fileType || "video/mp4",
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    const videoCount = await Video.countDocuments({ courseId });
    const order = videoCount + 1;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const video = new Video({
      courseId,
      title: title || fileName.split('.')[0] || "Untitled Video",
      storageProvider: "r2",
      objectKey,
      originalName: fileName,
      mimeType: fileType || "video/mp4",
      size: size || 0,
      expiresAt,
      uploadedAt: now,
      order,
      processingStatus: "pending",
    });

    await video.save();

    res.status(200).json({ uploadUrl, objectKey, videoId: video._id });
  } catch (error) {
    console.error("Generate presigned URL error:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

// Upload Complete trigger
export const uploadComplete = async (req, res) => {
  try {
    const { videoId, objectKey } = req.body;

    if (!videoId || !objectKey) {
      return res.status(400).json({ error: "videoId and objectKey are required" });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    video.processingStatus = "processing";
    await video.save();

    console.log(`[PROCESS] QUEUING_VIDEO ${video._id}`);
    await videoQueue.add('process-video', { videoId: video._id.toString() });

    // Instantly return to prevent timeouts
    res.status(200).json({ message: "Upload completed and queued for processing", video });
  } catch (error) {
    console.error("Complete upload error:", error);
    res.status(500).json({ error: error.message || "Failed to finalize upload" });
  }
};
