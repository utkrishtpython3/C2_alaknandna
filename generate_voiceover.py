import asyncio
import edge_tts
import subprocess
import os

SEGMENTS = [
    {
        "id": "seg1_intro",
        "start": 0.5,
        "text": "Every monsoon, high Himalayan gorges like the Alaknanda-Dhauliganga valley face catastrophic cloudbursts and glacial lake outbursts. In the 2021 Chamoli disaster, massive moraine entrainment bulked floodwaters into a deadly 7 meter-per-second debris slurry, giving downstream settlements less than 15 minutes to evacuate. Existing models take hours to compute, and mobile towers collapse immediately. Meet Alaknanda C2: an industrial-grade, physics-informed digital twin powered by NVIDIA enterprise toolchains and Nebius AI Cloud."
    },
    {
        "id": "seg2_webgl2_zen",
        "start": 25.0,
        "text": "In our 3D tactical command center, we render a true 10-meter elevation mesh using MapLibre GL. Pressing Z for Zen Mode dissolves the HUD into an unobstructed view of the valley. Notice the water flowing down the riverbed: this is a client-side WebGL2 ping-pong Framebuffer fluid solver resolving 2D Saint-Venant shallow water equations at 60 frames per second. Our 4D surge scrubber steps forward through time, tracking dynamic stage rise and velocity crests in real time."
    },
    {
        "id": "seg3_nvidia_nebius",
        "start": 53.0,
        "text": "Activating the 2021 Chamoli scenario triggers our coupled non-Newtonian debris solver, computing a devastating 2.10x bulking amplification. Opening our Nebius HPC Telemetry HUD reveals an enterprise GPU pipeline. We trained a 2D Navier-Stokes PINN using NVIDIA Modulus Core, compiled it with TensorRT 10, and deployed it on an NVIDIA Triton Inference Server running on Nebius AI Cloud with 8 H100 GPUs. Total P99 latency is just 3.78 milliseconds—31 times faster than dual Xeon CPUs!"
    },
    {
        "id": "seg4_multisource",
        "start": 105.0,
        "text": "Our Multi-Source Data Fusion Cockpit ingests live radar from IMD, INSAT-3DR satellite telemetry, CWC river gauges, and ECMWF forecasts, dynamically re-weighting sensors via Kalman-Bayesian fusion."
    },
    {
        "id": "seg5_sitrep",
        "start": 120.0,
        "text": "For civil protection commanders, Alaknanda C2 automatically synthesizes official NDRF Situation Reports with troop mobilization matrices and one-click printable PDF briefs."
    },
    {
        "id": "seg6_cap_lora",
        "start": 133.0,
        "text": "When cellular towers drown, our 865 megahertz LoRa mesh engine packs alerts into 32-byte telemetry and 48-byte evacuation bursts, broadcasting multilingual OASIS CAP alerts in English, Hindi SMS, and Garhwali VHF audio. Alaknanda C2: mission ready for the Himalayas."
    }
]

async def main():
    os.makedirs("audio_segments", exist_ok=True)
    for seg in SEGMENTS:
        print(f"Generating {seg['id']}...")
        communicate = edge_tts.Communicate(seg["text"], voice="en-US-ChristopherNeural", rate="+1%", pitch="-1Hz")
        out_path = f"audio_segments/{seg['id']}.mp3"
        await communicate.save(out_path)
        
        # probe duration
        res = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", out_path
        ], capture_output=True, text=True)
        dur = float(res.stdout.strip())
        print(f"  -> {seg['id']}: start={seg['start']}s, duration={dur:.2f}s, end={seg['start']+dur:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
