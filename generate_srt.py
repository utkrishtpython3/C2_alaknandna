# Generate synchronized SRT subtitles for Alaknanda C2 demo video

subtitles = [
    # Segment 1: 0.5s - 32.8s
    (1, "00:00:01,000", "00:00:07,500", "Every monsoon, high Himalayan gorges face catastrophic cloudbursts and glacial lake outbursts."),
    (2, "00:00:07,600", "00:00:15,000", "In the 2021 Chamoli disaster, moraine entrainment bulked floodwaters into a deadly 7 m/s debris slurry,"),
    (3, "00:00:15,100", "00:00:21,500", "leaving downstream settlements less than 15 minutes to evacuate."),
    (4, "00:00:21,600", "00:00:26,800", "Standard models take hours, and mobile networks collapse immediately."),
    (5, "00:00:26,900", "00:00:32,800", "Meet Alaknanda C2: an industrial-grade digital twin powered by NVIDIA and Nebius AI Cloud."),

    # Segment 2: 33.2s - 59.8s
    (6, "00:00:33,200", "00:00:38,500", "In our tactical command center, we render a true 10m elevation mesh using MapLibre GL."),
    (7, "00:00:38,600", "00:00:44,500", "Pressing Z for Zen Mode dissolves the HUD into an unobstructed view of the valley."),
    (8, "00:00:44,600", "00:00:51,500", "Notice the water: this is a client-side WebGL2 ping-pong Framebuffer fluid solver"),
    (9, "00:00:51,600", "00:00:56,800", "resolving 2D Saint-Venant shallow water equations at 60 frames per second."),
    (10, "00:00:56,900", "00:01:00,000", "Dynamic slope advection and boundary foam damping compute in real time."),

    # Segment 3: 61.0s - 82.2s
    (11, "00:01:01,000", "00:01:07,500", "Activating the 2021 Chamoli GLOF scenario triggers our coupled non-Newtonian debris solver,"),
    (12, "00:01:07,600", "00:01:12,500", "computing a devastating 2.10x bulking amplification."),
    (13, "00:01:12,600", "00:01:18,500", "Our dynamic 4D surge scrubber steps forward through time, tracking dynamic stage rise"),
    (14, "00:01:18,600", "00:01:22,500", "and velocity crests cell by cell down the gorge as the wave crests toward Tapovan barrage."),

    # Segment 4: 83.5s - 109.7s
    (15, "00:01:23,500", "00:01:29,000", "Opening our Nebius HPC Telemetry HUD reveals an enterprise GPU pipeline."),
    (16, "00:01:29,100", "00:01:34,800", "We trained a 2D Navier-Stokes PINN using NVIDIA Modulus Core, compiled with TensorRT 10,"),
    (17, "00:01:34,900", "00:01:41,000", "and deployed it on an NVIDIA Triton Server on Nebius AI Cloud with 8 H100 GPUs."),
    (18, "00:01:41,100", "00:01:47,500", "Total P99 latency is just 3.78 milliseconds—31 times faster than dual Xeon CPUs!"),

    # Segment 5: 110.0s - 125.0s
    (19, "00:01:49,500", "00:01:56,000", "Our Multi-Source Data Fusion Cockpit ingests live radar from IMD, satellite telemetry, and river gauges,"),
    (20, "00:01:56,100", "00:02:01,800", "dynamically re-weighting sensors via Kalman-Bayesian fusion,"),
    (21, "00:02:01,900", "00:02:05,800", "while synthesizing official NDRF situation reports."),

    # Segment 6: 126.0s - 143.5s
    (22, "00:02:06,500", "00:02:12,500", "When mobile networks drown, our 865 megahertz LoRa mesh engine packs alerts into 32-byte telemetry"),
    (23, "00:02:12,600", "00:02:18,500", "and 48-byte evacuation bursts, broadcasting multilingual OASIS CAP alerts in English, Hindi, and Garhwali."),
    (24, "00:02:18,600", "00:02:24,000", "Alaknanda C2: mission ready for the Himalayas.")
]

with open("alaknanda_c2_subtitles.srt", "w") as f:
    for idx, start, end, text in subtitles:
        f.write(f"{idx}\n{start} --> {end}\n{text}\n\n")

print("Generated alaknanda_c2_subtitles.srt with", len(subtitles), "entries.")
