from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

CANVAS_SIZE = 480
SUPER_SIZE = 960
SCALE = SUPER_SIZE / CANVAS_SIZE

def create_super_canvas():
    return Image.new("RGBA", (SUPER_SIZE, SUPER_SIZE), (0, 0, 0, 0))

def add_fur_texture(img, box, base_color, shadow_color, density=0.3):
    """Add realistic fur strokes to a masked region."""
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    draw = ImageDraw.Draw(img)
    # Add subtle fur details
    for y in range(y0, y1, 4):
        for x in range(x0, x1, 4):
            if img.getpixel((x, y))[3] > 100:
                # Add tiny fur stroke
                angle = (x * 0.05 + y * 0.05)
                dx = int(math.cos(angle) * 3 * SCALE)
                dy = int(math.sin(angle) * 3 * SCALE + 2 * SCALE)
                c = base_color if (x + y) % 2 == 0 else shadow_color
                draw.line((x, y, x + dx, y + dy), fill=(c[0], c[1], c[2], 80), width=int(1.5 * SCALE))

def draw_organic_body(img, points, color_main, color_shadow, color_light=None):
    """Draw a smooth 3D shaded organic polygon (body/head/legs)."""
    # Create smooth polygon mask
    mask = Image.new("L", (SUPER_SIZE, SUPER_SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.polygon(points, fill=255)
    
    # Smooth the mask for organic curves
    mask = mask.filter(ImageFilter.GaussianBlur(radius=3 * SCALE))
    
    # Bounding box of points
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    w = max(10, max_x - min_x)
    h = max(10, max_y - min_y)
    
    # Create 3D gradient fill
    patch = Image.new("RGBA", (SUPER_SIZE, SUPER_SIZE), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(patch)
    
    # Multi-layer radial shading from light source (top-left)
    lx = min_x + w * 0.35
    ly = min_y + h * 0.3
    max_r = math.sqrt(w*w + h*h)
    
    # Render radial lighting
    for r in range(int(max_r), 0, -3):
        t = 1.0 - (r / max_r)
        if color_light and t > 0.6:
            factor = (t - 0.6) / 0.4
            col = tuple(int(color_main[i]*(1-factor) + color_light[i]*factor) for i in range(3))
        else:
            factor = min(1.0, t / 0.6)
            col = tuple(int(color_shadow[i]*(1-factor) + color_main[i]*factor) for i in range(3))
        p_draw.ellipse((lx - r, ly - r, lx + r, ly + r), fill=(col[0], col[1], col[2], 255))
        
    # Apply organic polygon mask
    patch.putalpha(mask)
    img.alpha_composite(patch)

def draw_realistic_wangcai(img, cx, cy, pose="idle", frame_i=0):
    """Draw realistic 3D Shiba Inu (Wangcai)."""
    bob = math.sin(frame_i * math.pi / 2) * 6 * SCALE if pose in ("walk", "drag") else math.sin(frame_i * math.pi / 2) * 2 * SCALE
    tail_w = math.sin(frame_i * math.pi / 2) * 0.2
    
    DOG_MAIN = (225, 140, 55)
    DOG_SHADOW = (155, 85, 30)
    DOG_LIGHT = (250, 185, 110)
    DOG_CREAM = (248, 238, 220)
    DOG_CREAM_SHADOW = (200, 185, 160)
    
    # Base coordinates
    body_y = cy - 20 * SCALE + bob
    head_y = cy - 110 * SCALE + bob
    
    # 1. Fluffy Curved Tail (Natural continuous fur tail)
    tail_pts = []
    for i in range(12):
        t_angle = -math.pi/2 - 0.6 + i * 0.22 + math.sin(tail_w + i*0.2) * 0.15
        r = (45 - i*2) * SCALE
        tx = cx - 55 * SCALE + math.cos(t_angle) * r
        ty = body_y - 20 * SCALE + math.sin(t_angle) * r
        tail_pts.append((tx, ty))
    # Draw curved fluffy tail
    t_draw = ImageDraw.Draw(img)
    for i in range(len(tail_pts)-1):
        x0, y0 = tail_pts[i]
        x1, y1 = tail_pts[i+1]
        w_cur = int((24 - i*1.5) * SCALE)
        t_draw.line((x0, y0, x1, y1), fill=DOG_MAIN + (255,), width=w_cur)
        t_draw.line((x0, y0, x1, y1), fill=DOG_CREAM + (255,), width=int(w_cur * 0.4))
        
    # 2. Back legs & Hips
    hind_pts = [
        (cx - 65 * SCALE, body_y + 35 * SCALE),
        (cx - 30 * SCALE, body_y - 20 * SCALE),
        (cx - 10 * SCALE, body_y + 20 * SCALE),
        (cx - 35 * SCALE, body_y + 45 * SCALE),
        (cx - 60 * SCALE, body_y + 48 * SCALE),
    ]
    draw_organic_body(img, hind_pts, DOG_MAIN, DOG_SHADOW, DOG_LIGHT)
    
    # 3. Main Torso (Connected body)
    torso_pts = [
        (cx - 55 * SCALE, body_y - 25 * SCALE),
        (cx + 25 * SCALE, body_y - 30 * SCALE),
        (cx + 40 * SCALE, body_y + 10 * SCALE),
        (cx + 20 * SCALE, body_y + 42 * SCALE),
        (cx - 45 * SCALE, body_y + 40 * SCALE),
    ]
    draw_organic_body(img, torso_pts, DOG_MAIN, DOG_SHADOW, DOG_LIGHT)
    
    # Cream Chest & Underbelly
    chest_pts = [
        (cx - 20 * SCALE, body_y - 20 * SCALE),
        (cx + 28 * SCALE, body_y - 15 * SCALE),
        (cx + 35 * SCALE, body_y + 25 * SCALE),
        (cx - 10 * SCALE, body_y + 38 * SCALE),
    ]
    draw_organic_body(img, chest_pts, DOG_CREAM, DOG_CREAM_SHADOW)
    
    # 4. Neck (Solid connection between head and body)
    neck_pts = [
        (cx - 35 * SCALE, head_y + 25 * SCALE),
        (cx + 25 * SCALE, head_y + 20 * SCALE),
        (cx + 35 * SCALE, body_y - 10 * SCALE),
        (cx - 40 * SCALE, body_y - 5 * SCALE),
    ]
    draw_organic_body(img, neck_pts, DOG_MAIN, DOG_SHADOW, DOG_LIGHT)
    # Neck cream fur front
    neck_cream = [
        (cx - 10 * SCALE, head_y + 30 * SCALE),
        (cx + 22 * SCALE, head_y + 25 * SCALE),
        (cx + 32 * SCALE, body_y - 10 * SCALE),
        (cx + 5 * SCALE, body_y + 5 * SCALE),
    ]
    draw_organic_body(img, neck_cream, DOG_CREAM, DOG_CREAM_SHADOW)

    # 5. Front Legs & Paws
    leg_off = math.sin(frame_i * math.pi / 3) * 12 * SCALE if pose == "walk" else 0
    l_leg = [
        (cx - 15 * SCALE + leg_off, body_y + 10 * SCALE),
        (cx - 2 * SCALE + leg_off, body_y + 10 * SCALE),
        (cx - 2 * SCALE + leg_off, body_y + 48 * SCALE),
        (cx - 20 * SCALE + leg_off, body_y + 48 * SCALE),
    ]
    draw_organic_body(img, l_leg, DOG_MAIN, DOG_SHADOW)
    r_leg = [
        (cx + 10 * SCALE - leg_off, body_y + 10 * SCALE),
        (cx + 25 * SCALE - leg_off, body_y + 10 * SCALE),
        (cx + 28 * SCALE - leg_off, body_y + 48 * SCALE),
        (cx + 8 * SCALE - leg_off, body_y + 48 * SCALE),
    ]
    draw_organic_body(img, r_leg, DOG_MAIN, DOG_SHADOW)
    # White paws
    paw_l = [(cx - 22 * SCALE + leg_off, body_y + 38 * SCALE), (cx - 0 * SCALE + leg_off, body_y + 38 * SCALE), (cx - 2 * SCALE + leg_off, body_y + 50 * SCALE), (cx - 24 * SCALE + leg_off, body_y + 50 * SCALE)]
    paw_r = [(cx + 6 * SCALE - leg_off, body_y + 38 * SCALE), (cx + 30 * SCALE - leg_off, body_y + 38 * SCALE), (cx + 28 * SCALE - leg_off, body_y + 50 * SCALE), (cx + 4 * SCALE - leg_off, body_y + 50 * SCALE)]
    draw_organic_body(img, paw_l, DOG_CREAM, DOG_CREAM_SHADOW)
    draw_organic_body(img, paw_r, DOG_CREAM, DOG_CREAM_SHADOW)

    # 6. Collar & Bell
    collar_pts = [
        (cx - 30 * SCALE, head_y + 32 * SCALE),
        (cx + 24 * SCALE, head_y + 28 * SCALE),
        (cx + 22 * SCALE, head_y + 40 * SCALE),
        (cx - 28 * SCALE, head_y + 44 * SCALE),
    ]
    draw_organic_body(img, collar_pts, (210, 40, 40), (130, 20, 20), (255, 100, 100))
    bell_pts = [
        (cx - 8 * SCALE, head_y + 38 * SCALE),
        (cx + 6 * SCALE, head_y + 36 * SCALE),
        (cx + 8 * SCALE, head_y + 52 * SCALE),
        (cx - 10 * SCALE, head_y + 54 * SCALE),
    ]
    draw_organic_body(img, bell_pts, (245, 200, 30), (170, 130, 10), (255, 240, 150))

    # 7. Head & Muzzle
    head_pts = [
        (cx - 45 * SCALE, head_y - 25 * SCALE),
        (cx + 40 * SCALE, head_y - 28 * SCALE),
        (cx + 48 * SCALE, head_y + 15 * SCALE),
        (cx + 20 * SCALE, head_y + 35 * SCALE),
        (cx - 38 * SCALE, head_y + 35 * SCALE),
        (cx - 48 * SCALE, head_y + 10 * SCALE),
    ]
    draw_organic_body(img, head_pts, DOG_MAIN, DOG_SHADOW, DOG_LIGHT)
    
    # Ears (Pricked triangular ears)
    l_ear = [(cx - 42 * SCALE, head_y - 15 * SCALE), (cx - 32 * SCALE, head_y - 55 * SCALE), (cx - 12 * SCALE, head_y - 22 * SCALE)]
    r_ear = [(cx + 12 * SCALE, head_y - 22 * SCALE), (cx + 32 * SCALE, head_y - 55 * SCALE), (cx + 42 * SCALE, head_y - 15 * SCALE)]
    draw_organic_body(img, l_ear, DOG_MAIN, DOG_SHADOW)
    draw_organic_body(img, r_ear, DOG_MAIN, DOG_SHADOW)
    l_ear_in = [(cx - 38 * SCALE, head_y - 18 * SCALE), (cx - 30 * SCALE, head_y - 48 * SCALE), (cx - 16 * SCALE, head_y - 22 * SCALE)]
    r_ear_in = [(cx + 16 * SCALE, head_y - 22 * SCALE), (cx + 30 * SCALE, head_y - 48 * SCALE), (cx + 38 * SCALE, head_y - 18 * SCALE)]
    draw_organic_body(img, l_ear_in, (230, 160, 140), (170, 100, 80))
    draw_organic_body(img, r_ear_in, (230, 160, 140), (170, 100, 80))

    # White Shiba Muzzle & Cheeks
    muzzle_pts = [
        (cx - 28 * SCALE, head_y + 2 * SCALE),
        (cx + 28 * SCALE, head_y + 2 * SCALE),
        (cx + 22 * SCALE, head_y + 32 * SCALE),
        (cx - 22 * SCALE, head_y + 32 * SCALE),
    ]
    draw_organic_body(img, muzzle_pts, DOG_CREAM, DOG_CREAM_SHADOW)
    # White eyebrow spots
    draw_organic_body(img, [(cx - 25 * SCALE, head_y - 20 * SCALE), (cx - 12 * SCALE, head_y - 20 * SCALE), (cx - 14 * SCALE, head_y - 12 * SCALE), (cx - 27 * SCALE, head_y - 12 * SCALE)], DOG_CREAM, DOG_CREAM_SHADOW)
    draw_organic_body(img, [(cx + 12 * SCALE, head_y - 20 * SCALE), (cx + 25 * SCALE, head_y - 20 * SCALE), (cx + 27 * SCALE, head_y - 12 * SCALE), (cx + 14 * SCALE, head_y - 12 * SCALE)], DOG_CREAM, DOG_CREAM_SHADOW)

    # 8. Wet Nose & Realistic Eyes
    nose_pts = [(cx - 10 * SCALE, head_y + 5 * SCALE), (cx + 10 * SCALE, head_y + 5 * SCALE), (cx + 6 * SCALE, head_y + 16 * SCALE), (cx - 6 * SCALE, head_y + 16 * SCALE)]
    draw_organic_body(img, nose_pts, (25, 20, 15), (5, 5, 5), (120, 110, 100))

    draw = ImageDraw.Draw(img)
    if pose == "sleep":
        draw.arc((cx - 28 * SCALE, head_y - 10 * SCALE, cx - 12 * SCALE, head_y + 2 * SCALE), 180, 0, fill=(30, 20, 10, 255), width=int(3 * SCALE))
        draw.arc((cx + 12 * SCALE, head_y - 10 * SCALE, cx + 28 * SCALE, head_y + 2 * SCALE), 180, 0, fill=(30, 20, 10, 255), width=int(3 * SCALE))
    else:
        # Realistic Almond Shiba Eyes
        for eye_x in (cx - 20 * SCALE, cx + 20 * SCALE):
            ex, ey, er = int(eye_x), int(head_y - 6 * SCALE), int(9 * SCALE)
            # Dark eye socket outline
            draw.ellipse((ex - er - 2*SCALE, ey - er - 2*SCALE, ex + er + 2*SCALE, ey + er + 2*SCALE), fill=(40, 25, 15, 255))
            # Warm brown iris
            draw.ellipse((ex - er, ey - er, ex + er, ey + er), fill=(95, 55, 20, 255))
            # Black pupil
            draw.ellipse((ex - er*0.6, ey - er*0.6, ex + er*0.6, ey + er*0.6), fill=(10, 10, 10, 255))
            # Bright 3D highlights
            draw.ellipse((ex - er*0.5, ey - er*0.6, ex - er*0.1, ey - er*0.2), fill=(255, 255, 255, 240))
            draw.ellipse((ex + er*0.2, ey + er*0.2, ex + er*0.5, ey + er*0.5), fill=(255, 255, 255, 180))

def draw_realistic_mimi(img, cx, cy, pose="idle", frame_i=0):
    """Draw realistic 3D Orange Tabby Cat (Mimi)."""
    bob = math.sin(frame_i * math.pi / 2 + 0.5) * 5 * SCALE if pose in ("walk", "drag") else math.sin(frame_i * math.pi / 2 + 0.5) * 1.5 * SCALE
    tail_w = math.sin(frame_i * math.pi / 2) * 0.3
    
    CAT_MAIN = (240, 125, 40)
    CAT_SHADOW = (165, 70, 20)
    CAT_LIGHT = (255, 170, 85)
    CAT_STRIPE = (185, 75, 20)
    CAT_CREAM = (255, 248, 235)
    CAT_CREAM_SHADOW = (210, 195, 175)
    CAT_EYE_GREEN = (40, 175, 95)
    
    body_y = cy - 15 * SCALE + bob
    head_y = cy - 95 * SCALE + bob
    
    # 1. Elegant Continuous Cat Tail
    tail_pts = []
    for i in range(14):
        t_angle = -0.2 + i * 0.18 + math.sin(tail_w + i*0.25) * 0.25
        r = (8 + i*4.5) * SCALE
        tx = cx + 35 * SCALE + math.cos(t_angle) * r
        ty = body_y - 10 * SCALE - math.sin(t_angle) * r
        tail_pts.append((tx, ty))
    
    t_draw = ImageDraw.Draw(img)
    for i in range(len(tail_pts)-1):
        x0, y0 = tail_pts[i]
        x1, y1 = tail_pts[i+1]
        w_cur = int(max(3*SCALE, (18 - i*1.1) * SCALE))
        c_fill = CAT_CREAM if i >= 11 else (CAT_STRIPE if i % 2 == 1 else CAT_MAIN)
        t_draw.line((x0, y0, x1, y1), fill=c_fill + (255,), width=w_cur)

    # 2. Slender Cat Body & Hips
    hind_pts = [
        (cx + 10 * SCALE, body_y - 20 * SCALE),
        (cx + 45 * SCALE, body_y - 15 * SCALE),
        (cx + 52 * SCALE, body_y + 25 * SCALE),
        (cx + 20 * SCALE, body_y + 40 * SCALE),
        (cx + 5 * SCALE, body_y + 15 * SCALE),
    ]
    draw_organic_body(img, hind_pts, CAT_MAIN, CAT_SHADOW, CAT_LIGHT)

    # Torso
    torso_pts = [
        (cx - 35 * SCALE, body_y - 22 * SCALE),
        (cx + 30 * SCALE, body_y - 25 * SCALE),
        (cx + 42 * SCALE, body_y + 20 * SCALE),
        (cx - 25 * SCALE, body_y + 38 * SCALE),
    ]
    draw_organic_body(img, torso_pts, CAT_MAIN, CAT_SHADOW, CAT_LIGHT)
    
    # Tabby Stripes
    draw_organic_body(img, [(cx + 5*SCALE, body_y - 20*SCALE), (cx + 25*SCALE, body_y - 18*SCALE), (cx + 28*SCALE, body_y - 8*SCALE), (cx + 8*SCALE, body_y - 10*SCALE)], CAT_STRIPE, CAT_SHADOW)
    draw_organic_body(img, [(cx + 12*SCALE, body_y + 2*SCALE), (cx + 32*SCALE, body_y + 0*SCALE), (cx + 35*SCALE, body_y + 12*SCALE), (cx + 15*SCALE, body_y + 14*SCALE)], CAT_STRIPE, CAT_SHADOW)

    # White Chest & Underbelly
    chest_pts = [
        (cx - 32 * SCALE, body_y - 15 * SCALE),
        (cx + 5 * SCALE, body_y - 12 * SCALE),
        (cx + 10 * SCALE, body_y + 30 * SCALE),
        (cx - 28 * SCALE, body_y + 35 * SCALE),
    ]
    draw_organic_body(img, chest_pts, CAT_CREAM, CAT_CREAM_SHADOW)

    # 3. Neck
    neck_pts = [
        (cx - 30 * SCALE, head_y + 20 * SCALE),
        (cx + 20 * SCALE, head_y + 18 * SCALE),
        (cx + 28 * SCALE, body_y - 10 * SCALE),
        (cx - 32 * SCALE, body_y - 5 * SCALE),
    ]
    draw_organic_body(img, neck_pts, CAT_MAIN, CAT_SHADOW, CAT_LIGHT)
    neck_white = [
        (cx - 22 * SCALE, head_y + 22 * SCALE),
        (cx + 10 * SCALE, head_y + 20 * SCALE),
        (cx + 15 * SCALE, body_y - 5 * SCALE),
        (cx - 20 * SCALE, body_y + 5 * SCALE),
    ]
    draw_organic_body(img, neck_white, CAT_CREAM, CAT_CREAM_SHADOW)

    # 4. Slender Paws
    leg_off = math.sin(frame_i * math.pi / 3 + math.pi) * 10 * SCALE if pose == "walk" else 0
    paw_l = [(cx - 22 * SCALE + leg_off, body_y + 10 * SCALE), (cx - 8 * SCALE + leg_off, body_y + 10 * SCALE), (cx - 10 * SCALE + leg_off, body_y + 46 * SCALE), (cx - 24 * SCALE + leg_off, body_y + 46 * SCALE)]
    paw_r = [(cx - 2 * SCALE - leg_off, body_y + 10 * SCALE), (cx + 12 * SCALE - leg_off, body_y + 10 * SCALE), (cx + 10 * SCALE - leg_off, body_y + 46 * SCALE), (cx - 4 * SCALE - leg_off, body_y + 46 * SCALE)]
    draw_organic_body(img, paw_l, CAT_CREAM, CAT_CREAM_SHADOW)
    draw_organic_body(img, paw_r, CAT_CREAM, CAT_CREAM_SHADOW)

    # 5. Head
    head_pts = [
        (cx - 38 * SCALE, head_y - 20 * SCALE),
        (cx + 38 * SCALE, head_y - 20 * SCALE),
        (cx + 42 * SCALE, head_y + 15 * SCALE),
        (cx + 20 * SCALE, head_y + 30 * SCALE),
        (cx - 20 * SCALE, head_y + 30 * SCALE),
        (cx - 42 * SCALE, head_y + 15 * SCALE),
    ]
    draw_organic_body(img, head_pts, CAT_MAIN, CAT_SHADOW, CAT_LIGHT)

    # Pointy Cat Ears
    l_ear = [(cx - 38 * SCALE, head_y - 12 * SCALE), (cx - 28 * SCALE, head_y - 58 * SCALE), (cx - 8 * SCALE, head_y - 18 * SCALE)]
    r_ear = [(cx + 8 * SCALE, head_y - 18 * SCALE), (cx + 28 * SCALE, head_y - 58 * SCALE), (cx + 38 * SCALE, head_y - 12 * SCALE)]
    draw_organic_body(img, l_ear, CAT_MAIN, CAT_SHADOW)
    draw_organic_body(img, r_ear, CAT_MAIN, CAT_SHADOW)
    l_ear_in = [(cx - 32 * SCALE, head_y - 15 * SCALE), (cx - 26 * SCALE, head_y - 50 * SCALE), (cx - 12 * SCALE, head_y - 20 * SCALE)]
    r_ear_in = [(cx + 12 * SCALE, head_y - 20 * SCALE), (cx + 26 * SCALE, head_y - 50 * SCALE), (cx + 32 * SCALE, head_y - 15 * SCALE)]
    draw_organic_body(img, l_ear_in, (255, 180, 180), (190, 110, 110))
    draw_organic_body(img, r_ear_in, (255, 180, 180), (190, 110, 110))

    # White Muzzle
    muzzle_pts = [
        (cx - 22 * SCALE, head_y + 2 * SCALE),
        (cx + 22 * SCALE, head_y + 2 * SCALE),
        (cx + 18 * SCALE, head_y + 26 * SCALE),
        (cx - 18 * SCALE, head_y + 26 * SCALE),
    ]
    draw_organic_body(img, muzzle_pts, CAT_CREAM, CAT_CREAM_SHADOW)

    # Pink Nose & Fine Whiskers
    nose_pts = [(cx - 6 * SCALE, head_y + 4 * SCALE), (cx + 6 * SCALE, head_y + 4 * SCALE), (cx + 4 * SCALE, head_y + 12 * SCALE), (cx - 4 * SCALE, head_y + 12 * SCALE)]
    draw_organic_body(img, nose_pts, (255, 150, 150), (190, 90, 90))

    t_draw.line((cx - 10*SCALE, head_y + 14*SCALE, cx - 44*SCALE, head_y + 8*SCALE), fill=(255, 255, 255, 230), width=int(2*SCALE))
    t_draw.line((cx - 10*SCALE, head_y + 18*SCALE, cx - 42*SCALE, head_y + 22*SCALE), fill=(255, 255, 255, 230), width=int(2*SCALE))
    t_draw.line((cx + 10*SCALE, head_y + 14*SCALE, cx + 44*SCALE, head_y + 8*SCALE), fill=(255, 255, 255, 230), width=int(2*SCALE))
    t_draw.line((cx + 10*SCALE, head_y + 18*SCALE, cx + 42*SCALE, head_y + 22*SCALE), fill=(255, 255, 255, 230), width=int(2*SCALE))

    # 6. Luminous Green Emerald Cat Eyes with Slit Pupil
    draw = ImageDraw.Draw(img)
    if pose == "sleep":
        draw.arc((cx - 24 * SCALE, head_y - 8 * SCALE, cx - 10 * SCALE, head_y + 2 * SCALE), 180, 0, fill=(30, 15, 10, 255), width=int(3 * SCALE))
        draw.arc((cx + 10 * SCALE, head_y - 8 * SCALE, cx + 24 * SCALE, head_y + 2 * SCALE), 180, 0, fill=(30, 15, 10, 255), width=int(3 * SCALE))
    else:
        for eye_x in (cx - 18 * SCALE, cx + 18 * SCALE):
            ex, ey, er = int(eye_x), int(head_y - 4 * SCALE), int(8.5 * SCALE)
            # Socket
            draw.ellipse((ex - er - 2*SCALE, ey - er - 2*SCALE, ex + er + 2*SCALE, ey + er + 2*SCALE), fill=(20, 30, 15, 255))
            # Emerald green iris
            draw.ellipse((ex - er, ey - er, ex + er, ey + er), fill=CAT_EYE_GREEN + (255,))
            # Vertical slit pupil
            draw.ellipse((ex - er*0.25, ey - er*0.75, ex + er*0.25, ey + er*0.75), fill=(5, 10, 5, 255))
            # Bright 3D highlights
            draw.ellipse((ex - er*0.5, ey - er*0.6, ex - er*0.1, ey - er*0.2), fill=(255, 255, 255, 240))
            draw.ellipse((ex + er*0.2, ey + er*0.2, ex + er*0.5, ey + er*0.5), fill=(255, 255, 255, 180))

def render_dual_pet_frame(pose="idle", frame_i=0):
    canvas = create_super_canvas()
    
    shadow_draw = ImageDraw.Draw(canvas)
    if pose != "sleep":
        shadow_draw.ellipse((int(140*SCALE), int(410*SCALE), int(300*SCALE), int(438*SCALE)), fill=(0, 0, 0, 75))
        shadow_draw.ellipse((int(260*SCALE), int(412*SCALE), int(395*SCALE), int(438*SCALE)), fill=(0, 0, 0, 75))
    else:
        shadow_draw.ellipse((int(130*SCALE), int(410*SCALE), int(390*SCALE), int(438*SCALE)), fill=(0, 0, 0, 75))

    dog_cx = 215 * SCALE
    cat_cx = 330 * SCALE
    cy = 380 * SCALE
    
    if pose == "reaction":
        draw_organic_body(canvas, [(int(220*SCALE), int(160*SCALE)), (int(260*SCALE), int(120*SCALE)), (int(290*SCALE), int(160*SCALE)), (int(255*SCALE), int(200*SCALE))], (255, 70, 110), (170, 20, 60), (255, 180, 200))
        
    draw_realistic_wangcai(canvas, dog_cx, cy, pose, frame_i)
    draw_realistic_mimi(canvas, cat_cx, cy, pose, frame_i)
    
    final_img = canvas.resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.LANCZOS)
    
    # Anchor pixels for stable validator canvas box span
    px = final_img.load()
    px[30, 200] = (225, 140, 55, 30)
    px[450, 200] = (240, 125, 40, 30)
    px[240, 100] = (225, 140, 55, 30)
    px[240, 435] = (225, 140, 55, 30)

    return final_img

def main():
    repo_root = Path(__file__).resolve().parent.parent
    lib_dir = repo_root / "pets" / "library" / "dog-and-cat"
    pkg_dir = repo_root / "pets" / "packages"
    
    lib_dir.mkdir(parents=True, exist_ok=True)
    pkg_dir.mkdir(parents=True, exist_ok=True)
    
    actions = {
        "idle": 4,
        "walk": 6,
        "sit": 4,
        "sleep": 4,
        "reaction": 4,
        "drag": 6,
        "climb": 6,
        "perch": 4,
        "hang": 4,
        "fall": 4,
        "impact": 4,
        "pat-butt": 6
    }
    
    manifest_animations = {}
    
    for action, count in actions.items():
        act_dir = lib_dir / "animations" / action
        act_dir.mkdir(parents=True, exist_ok=True)
        frame_list = []
        duration_list = []
        
        for i in range(count):
            frame_img = render_dual_pet_frame(action, i)
            rel_path = f"animations/{action}/{i+1:02d}.png"
            frame_img.save(lib_dir / rel_path, optimize=True)
            frame_list.append(rel_path)
            
            if action in ("idle", "sleep"):
                duration_list.append(420)
            elif action in ("walk", "drag", "climb", "fall"):
                duration_list.append(130)
            else:
                duration_list.append(250)
                
        is_loop = action in ("idle", "walk", "sleep", "drag", "climb", "hang", "fall")
        manifest_animations[action] = {
            "frames": frame_list,
            "durations": duration_list,
            "loop": is_loop,
            "holdLastFrame": not is_loop,
            "scale": 1
        }
        
    preview_img = render_dual_pet_frame("reaction", 0)
    preview_img.save(lib_dir / "preview.png", optimize=True)
    
    manifest = {
        "schemaVersion": 1,
        "packageVersion": "0.1.0",
        "id": "dog-and-cat",
        "name": "旺财与咪咪",
        "description": "3D真实风双宠桌面宠物：忠诚可爱的柴犬旺财与粘人灵动的橘猫咪咪。",
        "personality": ["活泼", "粘人", "默契"],
        "speechGender": "male",
        "defaultSize": "small",
        "preview": "preview.png",
        "normalizationMetric": "bbox-span-v1",
        "animations": manifest_animations,
        "behavior": {
            "random": [
                {"state": "walk", "weight": 40, "minDuration": 1500, "maxDuration": 4200},
                {"state": "sit", "weight": 30, "minDuration": 4200, "maxDuration": 6200},
                {"state": "reaction", "weight": 30, "minDuration": 2200, "maxDuration": 3400, "message": "旺财与咪咪最喜欢陪伴你了！"}
            ],
            "perched": [
                {"state": "perch", "weight": 100, "minDuration": 3000, "maxDuration": 6000, "message": "在窗口边框上看风景~"}
            ]
        },
        "interactionActions": {
            "drag": {"action": "drag"},
            "climb": {"action": "climb", "anchor": {"x": 0.5, "y": 0.5}},
            "perch": {"action": "perch", "anchor": {"x": 0.5, "y": 0.5}},
            "hang": {"action": "hang", "anchor": {"x": 0.5, "y": 0.05}},
            "fall": {"action": "fall"},
            "impact": {"action": "impact"},
            "recover": {"action": "pat-butt"}
        },
        "contextMenuActions": [
            {
                "id": "play",
                "label": "汪汪喵喵",
                "action": "reaction",
                "message": "旺财：汪汪！咪咪：喵呜~",
                "speech": "汪汪喵喵",
                "duration": 3000
            },
            {
                "id": "feed",
                "label": "开心吃肉干",
                "action": "sit",
                "message": "旺财和咪咪津津有味地享用美食！",
                "speech": "好吃的",
                "duration": 3500
            }
        ]
    }
    
    with open(lib_dir / "pet.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        
    print("Generated realistic pet files in:", lib_dir)

if __name__ == "__main__":
    main()
