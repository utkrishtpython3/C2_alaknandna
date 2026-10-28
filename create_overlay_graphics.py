import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("video_overlays", exist_ok=True)

FONT_HELVETICA_BOLD = "/System/Library/Fonts/Helvetica.ttc"
FONT_MENLO_BOLD = "/System/Library/Fonts/Menlo.ttc"

def get_font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except:
        return ImageFont.load_default()

# 1. INTRO TITLE CARD (1920x1080)
intro_img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
draw = ImageDraw.Draw(intro_img)

# Dark glassmorphic background box in center
cx, cy = 960, 540
bw, bh = 1400, 540
bx0, by0 = cx - bw//2, cy - bh//2
bx1, by1 = cx + bw//2, cy + bh//2

# Subtle glow blur / backdrop
draw.rounded_rectangle([bx0-4, by0-4, bx1+4, by1+4], radius=24, fill=(16, 185, 129, 60))
draw.rounded_rectangle([bx0, by0, bx1, by1], radius=20, fill=(10, 14, 23, 235), outline=(16, 185, 129, 220), width=3)

# Badges at top
f_mono_sm = get_font(FONT_MENLO_BOLD, 22)
f_h1 = get_font(FONT_HELVETICA_BOLD, 72, index=1)
f_sub = get_font(FONT_HELVETICA_BOLD, 30)
f_tag = get_font(FONT_MENLO_BOLD, 20)

draw.text((cx, by0 + 60), "🏆 NVIDIA & NEBIUS AI CLOUD HACKATHON — GRAND PRIZE SUBMISSION", fill=(52, 211, 153), font=f_mono_sm, anchor="mm")
draw.text((cx, by0 + 155), "ALAKNANDA C2", fill=(255, 255, 255), font=f_h1, anchor="mm")
draw.text((cx, by0 + 235), "3D GPU Digital Twin & Early Warning System for Himalayan Surges", fill=(148, 163, 184), font=f_sub, anchor="mm")

# Divider line
draw.line([(bx0 + 80, by0 + 295), (bx1 - 80, by0 + 295)], fill=(30, 41, 59, 220), width=2)

# Technology badges row
badges = [
    "NVIDIA Modulus PINN",
    "TensorRT 10 (FP16/FP8)",
    "Triton Inference Server",
    "Nebius 8x H100 SXM5",
    "WebGL2 Ping-Pong FBO",
    "LoRa Mesh (865MHz)"
]
badge_x = bx0 + 110
for b in badges:
    bbox = draw.textbbox((0, 0), b, font=f_tag)
    bw_pill = bbox[2] - bbox[0] + 32
    draw.rounded_rectangle([badge_x, by0 + 340, badge_x + bw_pill, by0 + 386], radius=10, fill=(15, 23, 42, 220), outline=(56, 189, 248, 180), width=2)
    draw.text((badge_x + bw_pill//2, by0 + 363), b, fill=(224, 242, 254), font=f_tag, anchor="mm")
    badge_x += bw_pill + 20

# Metric bar at bottom
draw.text((cx, by0 + 445), "⚡ 3.78ms P99 Latency  •  1,420 inf/sec  •  2.10x Debris Bulking  •  Sub-15m Evacuation Margin", fill=(52, 211, 153), font=f_mono_sm, anchor="mm")

intro_img.save("video_overlays/intro_title_card.png")
print("Saved intro_title_card.png")

# 2. LOWER-THIRD BADGES (1920x1080 transparent PNG with card at bottom-left)
def make_lower_third(filename, chapter_tag, title_text, detail_text, metric_tag):
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    x0, y0 = 60, 840
    w, h = 980, 160
    x1, y1 = x0 + w, y0 + h
    
    # Outer glow
    d.rounded_rectangle([x0-2, y0-2, x1+2, y1+2], radius=16, fill=(16, 185, 129, 40))
    # Card background
    d.rounded_rectangle([x0, y0, x1, y1], radius=14, fill=(10, 15, 26, 235), outline=(16, 185, 129, 200), width=2)
    
    # Left accent vertical stripe
    d.rounded_rectangle([x0, y0, x0 + 8, y1], radius=4, fill=(16, 185, 129))
    
    f_tag = get_font(FONT_MENLO_BOLD, 18)
    f_title = get_font(FONT_HELVETICA_BOLD, 28, index=1)
    f_detail = get_font(FONT_HELVETICA_BOLD, 20)
    f_metric = get_font(FONT_MENLO_BOLD, 17)
    
    # Chapter tag + Metric pill
    d.text((x0 + 30, y0 + 32), chapter_tag, fill=(52, 211, 153), font=f_tag, anchor="lm")
    
    # Metric badge on top right of card
    m_bbox = d.textbbox((0, 0), metric_tag, font=f_metric)
    mw = m_bbox[2] - m_bbox[0] + 24
    d.rounded_rectangle([x1 - mw - 25, y0 + 18, x1 - 25, y0 + 46], radius=8, fill=(15, 23, 42, 220), outline=(56, 189, 248, 160), width=1)
    d.text((x1 - mw//2 - 25, y0 + 32), metric_tag, fill=(56, 189, 248), font=f_metric, anchor="mm")
    
    # Title
    d.text((x0 + 30, y0 + 75), title_text, fill=(255, 255, 255), font=f_title, anchor="lm")
    
    # Detail
    d.text((x0 + 30, y0 + 118), detail_text, fill=(148, 163, 184), font=f_detail, anchor="lm")
    
    img.save(f"video_overlays/{filename}")
    print(f"Saved {filename}")

make_lower_third(
    "badge_scene1.png",
    "STAGE 1 OF 6 // MISSION RECON",
    "3D Tactical Digital Twin & Himalayan Gorge",
    "10m Terrain-RGB Elevation Mesh • High-Gradient Headwaters • Joshimath Command Post",
    "ASL 1,418m"
)

make_lower_third(
    "badge_scene2.png",
    "STAGE 2 OF 6 // CLIENT GPGPU COMPUTING",
    "WebGL2 Multi-Pass Ping-Pong Fluid Solver & Zen Mode",
    "Saint-Venant 2D Shallow Water Equations • Slope Advection • Unobstructed 4K Zen View",
    "60 FPS // 512x512 FBO"
)

make_lower_third(
    "badge_scene3.png",
    "STAGE 3 OF 6 // COUPLED HYDRO-RHEOLOGY",
    "2021 Chamoli GLOF Simulation & 4D Surge Pilot",
    "Green-Ampt Suction Coupled to Dynamic Takahashi Bulking • Non-Newtonian Slurry Physics",
    "2.10x BULKING // 6.8 m/s"
)

make_lower_third(
    "badge_scene4.png",
    "STAGE 4 OF 6 // ENTERPRISE HPC CLUSTER",
    "NVIDIA Modulus PINN & Nebius AI Cloud Telemetry",
    "TensorRT 10 (FP16/INT8) • Triton Dynamic Batching • Nsight Systems Microsecond Trace",
    "3.78ms P99 // 31.3x SPEEDUP"
)

make_lower_third(
    "badge_scene5.png",
    "STAGE 5 OF 6 // MULTI-SOURCE SENSOR FUSION",
    "Kalman-Bayesian Telemetry & NDRF SITREP Hub",
    "ISRO INSAT-3DR QPE • IMD Doppler Radar • CWC River Gauges • Printable NDRF PDF",
    "5/5 DATA STREAMS"
)

make_lower_third(
    "badge_scene6.png",
    "STAGE 6 OF 6 // RESILIENT CIVIL PROTECTION",
    "OASIS CAP v1.2 Dispatch & 865MHz LoRa Mesh",
    "Multilingual Broadcast (Hindi SMS / Garhwali VHF) • 32B/48B Binary Radio Bit-Packer",
    "ZERO-TELECOM BLACKOUT"
)

# 3. OUTRO CARD (1920x1080)
outro_img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
d_out = ImageDraw.Draw(outro_img)

d_out.rounded_rectangle([bx0-4, by0-4, bx1+4, by1+4], radius=24, fill=(56, 189, 248, 60))
d_out.rounded_rectangle([bx0, by0, bx1, by1], radius=20, fill=(10, 14, 23, 240), outline=(56, 189, 248, 220), width=3)

d_out.text((cx, by0 + 75), "ALAKNANDA C2", fill=(255, 255, 255), font=f_h1, anchor="mm")
d_out.text((cx, by0 + 160), "MISSION COMPLETE // PRODUCTION READY", fill=(52, 211, 153), font=f_mono_sm, anchor="mm")
d_out.text((cx, by0 + 230), "Industrial-Grade Physics-ML Surrogate Twin for Mountain Disaster Resilience", fill=(148, 163, 184), font=f_sub, anchor="mm")

d_out.line([(bx0 + 80, by0 + 295), (bx1 - 80, by0 + 295)], fill=(30, 41, 59, 220), width=2)

d_out.text((cx, by0 + 360), "NVIDIA Modulus  •  TensorRT 10  •  Triton Server  •  Nebius AI Cloud (8x H100)  •  WebGL2", fill=(224, 242, 254), font=f_mono_sm, anchor="mm")
d_out.text((cx, by0 + 440), "https://github.com/your-username/alaknanda-dhauliganga-flashflood-ews", fill=(56, 189, 248), font=f_mono_sm, anchor="mm")

outro_img.save("video_overlays/outro_card.png")
print("Saved outro_card.png")
