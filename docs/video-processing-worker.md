# NAMA video-to-3D processing worker contract

## Product behavior
A consultant uploads a normal phone walkthrough video to the private `property-media` bucket. NAMA creates a row in `public.video_processing_jobs` with one of three modes:

- `spatial`: reconstruct a navigable scene and publish a browser-viewable spatial asset (preferred: Gaussian Splatting; NeRF fallback).
- `stereo`: generate a side-by-side stereoscopic video with distinct left/right views and depth metadata.
- `both`: generate both outputs from the same source.

The mobile app only uploads/enqueues and reads job status. It must never run GPU reconstruction on the phone.

## Worker responsibilities
A separately deployed GPU worker (Modal, RunPod, or equivalent) must:
1. Authenticate using a server-only shared secret; never ship it in the app.
2. Claim queued jobs in FIFO order, mark `processing`, and update progress.
3. Download `input_video_path` from the private bucket using service-role credentials.
4. Validate duration, resolution, file type, camera motion, blur, and scene coverage.
5. For `spatial`, reconstruct the scene and upload a web-viewable asset bundle. Do not label a monocular depth effect as a navigable 3D reconstruction.
6. For `stereo`, synthesize separate left/right views, encode an SBS MP4, and include comfort-safe disparity limits. Mark the result as AI-estimated depth.
7. Upload outputs under `{owner_id}/{property_id}/derived/{job_id}/...` in `property-media`.
8. Update only its job row using service-role access: `status`, `progress`, `spatial_asset_path`, `stereo_video_path`, `metadata`, `error_message`, timestamps.
9. Make retries idempotent and never expose private source videos or service credentials publicly.

## Required output metadata
- `spatial_asset_path`: scene manifest / entry point for the spatial viewer.
- `stereo_video_path`: SBS MP4 path.
- `metadata.depth_quality`: estimated quality and confidence.
- `metadata.source_type`: `monocular_phone_video`.
- `metadata.warnings`: low-light, motion blur, missing coverage, or reconstruction limitations.

## Current deployment gate
The database queue and app integration do not themselves perform GPU inference. A GPU worker URL and secret must be provisioned and stored as server-side secrets before jobs can move from `queued` to `processing`. Until then, NAMA must clearly show that processing is waiting for the worker; it must not display fake progress or claim a completed conversion.

## Worker control endpoint
Deploy `supabase/functions/video-processing-worker` and set the server-side Supabase secret `NAMA_VIDEO_WORKER_SECRET`. The GPU worker calls `POST /functions/v1/video-processing-worker` with `x-nama-worker-secret` and one of:
- `{ "action": "claim" }` — atomically claims one queued job and returns a short-lived signed source-video URL.
- `{ "action": "progress", "job_id": "...", "progress": 35 }` — reports progress.
- `{ "action": "complete", "job_id": "...", "spatial_asset_path": "...", "stereo_video_path": "...", "metadata": {} }` — stores outputs and marks complete. Supply only outputs required by the selected mode.
- `{ "action": "fail", "job_id": "...", "error_message": "..." }` — records a failure.

The endpoint is intentionally not callable by the mobile app. Keep the worker secret and service-role key only in server-side secret stores.
