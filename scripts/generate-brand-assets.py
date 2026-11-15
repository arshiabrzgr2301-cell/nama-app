#!/usr/bin/env python3
"""Generate NAMA's branded PNG assets using only Python's standard library."""
import math
import os
import struct
import zlib

ASSETS_DIR = "assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))

def blend(dst, src, amount):
    return tuple(int(dst[i] * (1 - amount) + src[i] * amount) for i in range(3))

def segment_distance(x, y, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    t = 0 if length_sq == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / length_sq))
    px, py = x1 + t * dx, y1 + t * dy
    return math.hypot(x - px, y - py), t

def render(size, transparent=False):
    pixels = []
    scale = size / 512
    segments = [
        (176, 145, 176, 355, (39, 200, 244), (39, 200, 244)),
        (176, 145, 336, 355, (139, 92, 246), (24, 198, 163)),
        (336, 145, 336, 355, (24, 198, 163), (24, 198, 163)),
    ]
    for yy in range(size):
        row = []
        y = (yy + 0.5) / scale
        for xx in range(size):
            x = (xx + 0.5) / scale
            if transparent:
                color, alpha = (0, 0, 0), 0
            else:
                radius = math.hypot(x - 256, y - 240)
                glow = max(0, 1 - radius / 340)
                color, alpha = (int(5 + 4 * glow), int(11 + 13 * glow), int(24 + 30 * glow)), 255
            for x1, y1, x2, y2, c1, c2 in segments:
                distance, t = segment_distance(x, y, x1, y1, x2, y2)
                line_color = mix(c1, c2, t)
                if distance < 36:
                    color = blend(color, line_color, (1 - distance / 36) ** 2 * 0.20)
                if distance < 15:
                    color, alpha = line_color, 255
            dx, dy = x - 256, y - 372
            angle = -math.radians(12)
            rx = dx * math.cos(angle) - dy * math.sin(angle)
            ry = dx * math.sin(angle) + dy * math.cos(angle)
            ellipse = (rx / 178) ** 2 + (ry / 43) ** 2
            edge_distance = abs(math.sqrt(max(ellipse, 0)) - 1) * 44
            if edge_distance < 15:
                t = max(0, min(1, (rx + 178) / 356))
                ring_color = mix((39, 200, 244), (139, 92, 246), t)
                color = blend(color, ring_color, (1 - edge_distance / 15) ** 2 * 0.20)
            if edge_distance < 3.3:
                color = mix((39, 200, 244), (139, 92, 246), max(0, min(1, (rx + 178) / 356)))
                alpha = 220 if transparent else 255
            dot = math.hypot(x - 365, y - 205)
            if dot < 8:
                color, alpha = (24, 198, 163), 255
            elif dot < 16:
                color = blend(color, (24, 198, 163), 0.18)
            if 154 <= x <= 169 and 316 <= y <= 331:
                color, alpha = (234, 248, 255), 255
            if 205 <= x <= 220 and 316 <= y <= 331:
                color, alpha = (234, 248, 255), 255
            row.append((*color, alpha))
        pixels.append(row)
    return pixels

def write_png(path, pixels):
    height, width = len(pixels), len(pixels[0])
    raw = b"".join(b"\x00" + bytes(channel for pixel in row for channel in pixel) for row in pixels)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as output:
        output.write(png)

write_png(os.path.join(ASSETS_DIR, "icon.png"), render(1024))
write_png(os.path.join(ASSETS_DIR, "adaptive-icon.png"), render(1024, transparent=True))
write_png(os.path.join(ASSETS_DIR, "splash.png"), render(1024))
write_png(os.path.join(ASSETS_DIR, "favicon.png"), render(96))
print("NAMA brand assets generated in", ASSETS_DIR)
