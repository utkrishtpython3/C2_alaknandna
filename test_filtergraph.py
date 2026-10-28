# Let's inspect the overlay timings and build the complete ffmpeg command

# Inputs:
# 0: Video (144.92s)
# 1: video_overlays/intro_title_card.png (t: 0 to 4.5)
# 2: video_overlays/badge_scene1.png (t: 5 to 26)
# 3: video_overlays/badge_scene2.png (t: 32 to 56)
# 4: video_overlays/badge_scene3.png (t: 62 to 82)
# 5: video_overlays/badge_scene4.png (t: 84 to 106)
# 6: video_overlays/badge_scene5.png (t: 109 to 124)
# 7: video_overlays/badge_scene6.png (t: 126 to 139)
# 8: video_overlays/outro_card.png (t: 140 to 144.9)
# 9: master_audio_track.m4a (145.0s)

overlays = [
    (1, "intro", 0.0, 4.5, 0.0, 0.5, 4.0, 0.5),
    (2, "b1", 5.0, 26.0, 5.0, 0.6, 25.4, 0.6),
    (3, "b2", 32.0, 56.0, 32.0, 0.6, 55.4, 0.6),
    (4, "b3", 62.0, 82.0, 62.0, 0.6, 81.4, 0.6),
    (5, "b4", 84.0, 106.0, 84.0, 0.6, 105.4, 0.6),
    (6, "b5", 109.0, 124.0, 109.0, 0.6, 123.4, 0.6),
    (7, "b6", 126.0, 139.0, 126.0, 0.6, 138.4, 0.6),
    (8, "outro", 140.0, 144.9, 140.0, 0.6, 144.5, 0.4),
]

filter_parts = []
# Process each overlay stream
for idx, name, t_start, t_end, f_in_st, f_in_d, f_out_st, f_out_d in overlays:
    filter_parts.append(f"[{idx}:v]format=rgba,fade=t=in:st={f_in_st}:d={f_in_d}:alpha=1,fade=t=out:st={f_out_st}:d={f_out_d}:alpha=1[{name}_f]")

# Chain overlays onto base video
prev = "0:v"
for i, (idx, name, t_start, t_end, *_) in enumerate(overlays):
    next_node = f"v_step{i+1}" if i < len(overlays)-1 else "v_out"
    filter_parts.append(f"[{prev}][{name}_f]overlay=0:0:enable='between(t,{t_start},{t_end})'[{next_node}]")
    prev = next_node

full_filter = ";\n".join(filter_parts)
print("Filtergraph length:", len(full_filter))
with open("filtergraph.txt", "w") as f:
    f.write(full_filter)
print("Wrote filtergraph.txt")
