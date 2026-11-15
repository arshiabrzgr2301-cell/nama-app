# NAMA Guided 360 Tour — Release 1

## Product decision
Release 1 ships the guided 360-degree panorama experience. It does not claim free-roam 6DoF reconstruction or true stereoscopic depth.

## Consultant workflow
1. Create a property as a draft.
2. Open **مدیریت تور هدایت‌شده ۳۶۰**.
3. Upload one full equirectangular panorama for each capture point / room.
4. Choose the entry room.
5. Select a source room and destination room.
6. Tap the doorway / transition direction in the interactive 360 preview.
7. Save the connection and repeat for each route.
8. Publish the property and share its public tour link.

## Viewer behavior
- Browse the room list directly.
- Look around each fixed capture point in 360 degrees.
- Follow saved directional hotspots to move between rooms.
- Enable phone motion/orientation when supported.
- Pause or resume optional auto-rotation.
- Public tour is available only while the organization and subscription are active.

## Capture requirements
- Use one complete equirectangular 360 panorama at each meaningful location.
- A normal flat photo or ordinary video is not a spherical panorama.
- Supported image formats: JPG, PNG, WebP.
- Keep the camera near the center of each room and capture doorways in the direction that will be linked.

## Backend and access
- `property_tour_scenes`: panorama per capture point.
- `property_tour_links`: directed room-to-room hotspot with yaw/pitch.
- Active organization members can manage shared scenes and links.
- Public access is limited to published properties with an active organization subscription.
- Media remains in the private `property-media` bucket; the public tour creates short-lived signed image URLs.

## Deferred work
GPU-based Gaussian Splatting / NeRF and AI-generated stereoscopic video remain future work. They are not part of the first commercial release until a real GPU worker, viewer, quality checks, and device testing are complete.
