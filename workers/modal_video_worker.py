import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import cv2
import modal
import numpy as np
import requests
import torch
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

APP_NAME = "nama-video-worker"
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_SECRET = os.environ["NAMA_VIDEO_WORKER_SECRET"]
CONTROL_URL = f"{SUPABASE_URL}/functions/v1/video-processing-worker"
BUCKET = "property-media"

worker_secret = modal.Secret.from_dict({
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY": SERVICE_ROLE_KEY,
    "NAMA_VIDEO_WORKER_SECRET": WORKER_SECRET,
})

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "colmap", "libgl1", "libglib2.0-0")
    .pip_install(
        "torch",
        "torchvision",
        "opencv-python-headless==4.10.0.84",
        "transformers==4.46.3",
        "accelerate==1.1.1",
        "nerfstudio==1.1.5",
        "requests",
        "numpy<2",
    )
)

app = modal.App(APP_NAME)


def control(action: str, **payload):
    response = requests.post(
        CONTROL_URL,
        json={"action": action, **payload},
        headers={"x-nama-worker-secret": WORKER_SECRET, "Content-Type": "application/json"},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def storage_upload(local_path: Path, remote_path: str, content_type: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{remote_path}"
    with local_path.open("rb") as stream:
        response = requests.post(
            url,
            data=stream,
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            timeout=900,
        )
    response.raise_for_status()
    return remote_path


def run_command(command, cwd=None):
    result = subprocess.run(
        command, cwd=cwd, text=True, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, timeout=7200
    )
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{result.stdout[-6000:]}")
    return result.stdout


def make_stereo(source: Path, output: Path, work: Path):
    model_id = "depth-anything/Depth-Anything-V2-Small-hf"
    processor = AutoImageProcessor.from_pretrained(model_id)
    model = AutoModelForDepthEstimation.from_pretrained(model_id).to("cuda").eval()

    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise RuntimeError("ورودی ویدیو قابل خواندن نیست.")
    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if width < 640 or height < 360 or frames < 2:
        raise RuntimeError("کیفیت یا ابعاد ویدیوی ورودی برای تبدیل مناسب نیست.")

    silent_sbs = work / "stereo_silent.mp4"
    writer = cv2.VideoWriter(
        str(silent_sbs), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width * 2, height)
    )
    if not writer.isOpened():
        raise RuntimeError("ساخت فایل ویدیوی خروجی ممکن نشد.")

    frame_index = 0
    # Process every frame; depth is estimated, not captured by a stereo camera.
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        inputs = processor(images=rgb, return_tensors="pt").to("cuda")
        with torch.inference_mode():
            prediction = model(**inputs).predicted_depth
            depth = torch.nn.functional.interpolate(
                prediction.unsqueeze(1), size=(height, width),
                mode="bicubic", align_corners=False
            ).squeeze().float().cpu().numpy()

        low, high = np.percentile(depth, [2, 98])
        depth = np.clip((depth - low) / max(high - low, 1e-6), 0, 1)
        # Conservative disparity to reduce eye strain; near objects shift more.
        disparity = (depth * 10.0).astype(np.float32)
        x, y = np.meshgrid(np.arange(width, dtype=np.float32),
                           np.arange(height, dtype=np.float32))
        left = cv2.remap(frame, x + disparity / 2, y, cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_REPLICATE)
        right = cv2.remap(frame, x - disparity / 2, y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REPLICATE)
        writer.write(np.concatenate([left, right], axis=1))
        frame_index += 1
        if frame_index % max(int(fps * 5), 1) == 0:
            # progress callback is handled by the caller between stages.
            pass

    capture.release()
    writer.release()
    if frame_index == 0:
        raise RuntimeError("هیچ فریمی از ویدیو استخراج نشد.")

    # Keep original audio when present; output is standard side-by-side stereo.
    run_command([
        "ffmpeg", "-y", "-i", str(silent_sbs), "-i", str(source),
        "-map", "0:v:0", "-map", "1:a?", "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest", str(output)
    ])
    return {"frames": frame_index, "fps": fps, "width": width, "height": height,
            "depth_model": model_id, "depth_quality": "AI-estimated monocular depth"}


def make_spatial(source: Path, output_dir: Path, work: Path):
    data_dir = work / "nerfstudio-data"
    train_dir = work / "nerfstudio-output"
    run_command([
        "ns-process-data", "video", "--data", str(source),
        "--output-dir", str(data_dir), "--camera-type", "perspective",
        "--num-frames-target", "240"
    ])
    run_command([
        "ns-train", "splatfacto", "--data", str(data_dir),
        "--output-dir", str(train_dir), "--max-num-iterations", "15000"
    ])
    configs = list(train_dir.glob("**/config.yml"))
    if not configs:
        raise RuntimeError("Nerfstudio config.yml was not generated.")
    export_dir = work / "gaussian-splat"
    run_command([
        "ns-export", "gaussian-splat", "--load-config", str(configs[-1]),
        "--output-dir", str(export_dir)
    ])
    ply_files = list(export_dir.glob("*.ply"))
    if not ply_files:
        ply_files = list(export_dir.glob("**/*.ply"))
    if not ply_files:
        raise RuntimeError("Gaussian Splat PLY export was not generated.")
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "scene.ply"
    target.write_bytes(ply_files[0].read_bytes())
    manifest = {
        "format": "gaussian_splat_ply",
        "asset": "scene.ply",
        "viewer_required": True,
        "reconstruction": "nerfstudio_splatfacto",
        "source_type": "monocular_phone_video",
        "navigation_note": "Requires a Gaussian-splat viewer in the NAMA app."
    }
    (output_dir / "scene.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest


@app.function(image=image, gpu="L4", timeout=7200, max_containers=1,
              secrets=[worker_secret])
def process_video(job: dict, input_video_url: str):
    job_id = job["id"]
    owner_id = job.get("owner_id")
    property_id = job["property_id"]
    prefix = f"{owner_id}/{property_id}/derived/{job_id}"
    with tempfile.TemporaryDirectory(prefix="nama-") as temp:
        work = Path(temp)
        source = work / "source-video"
        response = requests.get(input_video_url, stream=True, timeout=300)
        response.raise_for_status()
        with source.open("wb") as stream:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    stream.write(chunk)
        if source.stat().st_size < 1024 * 100:
            raise RuntimeError("فایل ویدیوی ورودی خالی یا بیش از حد کوچک است.")

        mode = job["processing_mode"]
        spatial_path = None
        stereo_path = None
        metadata = {
            "source_type": "monocular_phone_video",
            "warnings": [
                "عمق ویدیوی VR با هوش مصنوعی تخمین زده می‌شود و استریوی واقعی دوربین دوچشمی نیست."
            ]
        }
        control("progress", job_id=job_id, progress=5)

        if mode in ("stereo", "both"):
            stereo_file = work / "stereo-sbs.mp4"
            stereo_meta = make_stereo(source, stereo_file, work)
            stereo_path = f"{prefix}/stereo-sbs.mp4"
            storage_upload(stereo_file, stereo_path, "video/mp4")
            metadata["stereo"] = stereo_meta
            control("progress", job_id=job_id, progress=55 if mode == "both" else 90)

        if mode in ("spatial", "both"):
            spatial_dir = work / "spatial"
            spatial_meta = make_spatial(source, spatial_dir, work)
            spatial_path = f"{prefix}/scene.json"
            storage_upload(spatial_dir / "scene.json", spatial_path, "application/json")
            storage_upload(spatial_dir / "scene.ply", f"{prefix}/scene.ply",
                           "application/octet-stream")
            metadata["spatial"] = spatial_meta
            control("progress", job_id=job_id, progress=95)

        control("complete", job_id=job_id,
                spatial_asset_path=spatial_path, stereo_video_path=stereo_path,
                metadata=metadata)


@app.function(image=modal.Image.debian_slim(python_version="3.11").pip_install("requests"),
              schedule=modal.Period(minutes=1), timeout=90, secrets=[worker_secret])
def poll_queue():
    try:
        result = control("claim")
        job = result.get("job")
        if job:
            # Fetch owner_id from the trusted claim response; needed for scoped output paths.
            process_video.spawn(job, result["input_video_url"])
    except Exception as exc:
        print(f"NAMA queue poll failed: {type(exc).__name__}: {exc}")
