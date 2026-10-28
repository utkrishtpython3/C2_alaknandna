import subprocess

cmd = [
    "ffmpeg", "-y",
    # Input 0: Base video (144.92s)
    "-i", "/Users/utkrishtpathak/Library/Mobile Documents/com~apple~CloudDocs/Downloads/work/alaknanda_c2_nvidia_hackathon_demo_2m25s.mp4",
    # Inputs 1-8: Overlays looped
    "-loop", "1", "-t", "145", "-i", "video_overlays/intro_title_card.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/badge_scene1.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/badge_scene2.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/badge_scene3.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/badge_scene4.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/badge_scene5.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/badge_scene6.png",
    "-loop", "1", "-t", "145", "-i", "video_overlays/outro_card.png",
    # Input 9: Master Audio (145.0s)
    "-i", "master_audio_track.m4a",
    # Input 10: Subtitles
    "-i", "alaknanda_c2_subtitles.srt",
    
    "-filter_complex",
    # Fades for each overlay
    "[1:v]format=rgba,fade=t=in:st=0.0:d=0.5:alpha=1,fade=t=out:st=4.0:d=0.5:alpha=1[intro_f];"
    "[2:v]format=rgba,fade=t=in:st=5.0:d=0.6:alpha=1,fade=t=out:st=25.4:d=0.6:alpha=1[b1_f];"
    "[3:v]format=rgba,fade=t=in:st=32.0:d=0.6:alpha=1,fade=t=out:st=55.4:d=0.6:alpha=1[b2_f];"
    "[4:v]format=rgba,fade=t=in:st=61.0:d=0.6:alpha=1,fade=t=out:st=81.4:d=0.6:alpha=1[b3_f];"
    "[5:v]format=rgba,fade=t=in:st=84.0:d=0.6:alpha=1,fade=t=out:st=105.4:d=0.6:alpha=1[b4_f];"
    "[6:v]format=rgba,fade=t=in:st=109.0:d=0.6:alpha=1,fade=t=out:st=123.4:d=0.6:alpha=1[b5_f];"
    "[7:v]format=rgba,fade=t=in:st=126.0:d=0.6:alpha=1,fade=t=out:st=138.4:d=0.6:alpha=1[b6_f];"
    "[8:v]format=rgba,fade=t=in:st=139.8:d=0.6:alpha=1,fade=t=out:st=144.5:d=0.4:alpha=1[outro_f];"
    
    # Layer overlays sequentially
    "[0:v][intro_f]overlay=0:0:enable='between(t,0,4.5)'[v1];"
    "[v1][b1_f]overlay=0:0:enable='between(t,5.0,26.0)'[v2];"
    "[v2][b2_f]overlay=0:0:enable='between(t,32.0,56.0)'[v3];"
    "[v3][b3_f]overlay=0:0:enable='between(t,61.0,82.0)'[v4];"
    "[v4][b4_f]overlay=0:0:enable='between(t,84.0,106.0)'[v5];"
    "[v5][b5_f]overlay=0:0:enable='between(t,109.0,124.0)'[v6];"
    "[v6][b6_f]overlay=0:0:enable='between(t,126.0,139.0)'[v7];"
    "[v7][outro_f]overlay=0:0:enable='between(t,139.8,144.92)'[vout]",
    
    "-map", "[vout]",
    "-map", "9:a",
    "-map", "10:s",
    
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "256k",
    "-c:s", "mov_text",
    "-metadata:s:s:0", "language=eng",
    "-metadata:s:s:0", "title=English",
    "-t", "144.92",
    "/Users/utkrishtpathak/Library/Mobile Documents/com~apple~CloudDocs/Downloads/work/alaknanda_c2_nvidia_hackathon_master_showcase.mp4"
]

print("Starting render...")
subprocess.run(cmd, check=True)
print("Render complete: alaknanda_c2_nvidia_hackathon_master_showcase.mp4")
