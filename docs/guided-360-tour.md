# NAMA Guided 360 Tour (Option 3)

## Chosen product behavior
The first release uses a guided 360-degree panorama tour, not free-roam 6DoF reconstruction. A viewer can look around from a fixed capture point, pause/inspect, choose a room, and follow hotspots to the next capture point.

## Capture format
- Capture one full equirectangular 360 panorama at each meaningful position (living room, kitchen, bedrooms, bathrooms, entrance).
- Each scene is a separate image; a normal flat phone photo or ordinary video is not a substitute for a spherical panorama.
- Scene links are directed navigation points placed at the doorway/transition direction.
- The initial schema supports a designated entry scene and sort order for room navigation.

## Data model
- `property_tour_scenes`: one panorama and label per capture point.
- `property_tour_links`: a yaw/pitch hotspot connecting one scene to another.
- Existing `properties.panorama_path` and `hotspots` remain supported for backward compatibility with single-panorama tours.

## Storage path
`{owner_id}/{property_id}/scenes/{scene_id}.jpg`

## Release sequence
1. Apply the scene/link migration.
2. Add a scene capture/upload manager in the consultant app.
3. Extend the public tour page to load all scenes and navigate between them.
4. Add VR headset presentation and verify orientation/comfort on target devices.

No GPU worker is required for this product path. It is image-based 360 navigation.
