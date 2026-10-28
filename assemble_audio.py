import subprocess

# Generate 145s ambient bed with subtle cyber drone + low pass
cmd_bed = [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "sine=frequency=55:duration=145",
    "-f", "lavfi", "-i", "anoisesrc=d=145:c=pink:r=48000:a=0.015",
    "-filter_complex",
    "[0:a]volume=0.05,lowpass=f=120[bass];[1:a]volume=0.02,lowpass=f=300[air];[bass][air]amix=inputs=2:duration=first,afade=t=in:ss=0:d=2,afade=t=out:st=142:d=3[bed]",
    "-map", "[bed]",
    "-c:a", "aac", "-b:a", "192k",
    "ambient_bed.m4a"
]
subprocess.run(cmd_bed, check=True)
print("Created ambient_bed.m4a")

# Now mix the 6 timed voiceover segments with delays + ambient bed
# Delays:
# seg1: 500ms
# seg2: 33200ms
# seg3: 61000ms
# seg4: 83500ms
# seg5: 109500ms
# seg6: 126000ms
filter_complex = (
    "[0:a]adelay=500|500[v1];"
    "[1:a]adelay=33200|33200[v2];"
    "[2:a]adelay=61000|61000[v3];"
    "[3:a]adelay=83500|83500[v4];"
    "[4:a]adelay=109500|109500[v5];"
    "[5:a]adelay=126000|126000[v6];"
    "[6:a]volume=0.4[bg];"
    "[v1][v2][v3][v4][v5][v6]amix=inputs=6:duration=longest:normalize=0[voice];"
    "[voice]volume=1.2,compand=attacks=0.02:decays=0.1:points=-80/-80|-20/-10|0/-3[voice_comp];"
    "[voice_comp][bg]amix=inputs=2:duration=longest:normalize=0,afade=t=out:st=143:d=1.9[outa]"
)

cmd_mix = [
    "ffmpeg", "-y",
    "-i", "audio_segments_timed/seg1_intro.mp3",
    "-i", "audio_segments_timed/seg2_webgl2_zen.mp3",
    "-i", "audio_segments_timed/seg3_debris_surge.mp3",
    "-i", "audio_segments_timed/seg4_nvidia_nebius.mp3",
    "-i", "audio_segments_timed/seg5_multisource_sitrep.mp3",
    "-i", "audio_segments_timed/seg6_cap_lora.mp3",
    "-i", "ambient_bed.m4a",
    "-filter_complex", filter_complex,
    "-map", "[outa]",
    "-c:a", "aac", "-b:a", "256k",
    "master_audio_track.m4a"
]
subprocess.run(cmd_mix, check=True)
print("Created master_audio_track.m4a")

# Probe duration of master audio
res = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "master_audio_track.m4a"], capture_output=True, text=True)
print("Master Audio Duration:", res.stdout.strip(), "seconds")
