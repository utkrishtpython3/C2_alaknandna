import asyncio
import edge_tts
import subprocess
import os

SEGMENTS = [
    {
        "id": "seg1_intro",
        "start": 1.0,
        "rate": "+4%",
        "text": "Every monsoon, high Himalayan gorges like the Alaknanda-Dhauliganga valley face catastrophic cloudbursts and glacial lake outbursts. In the 2021 Chamoli disaster, massive moraine entrainment bulked floodwaters into a deadly 7 meter-per-second debris slurry, giving downstream settlements less than 15 minutes to evacuate. Standard models take hours, and mobile networks collapse. Meet Alaknanda C2: an industrial-grade, physics-informed digital twin powered by NVIDIA and Nebius AI Cloud."
    },
    {
        "id": "seg2_webgl2_zen",
        "start": 31.0,
        "rate": "+4%",
        "text": "In our tactical command center, we render a true 10-meter elevation mesh using MapLibre GL. Pressing Z for Zen Mode dissolves the HUD into an unobstructed view of the valley. Notice the water flowing down the riverbed: this is a client-side WebGL2 ping-pong Framebuffer fluid solver resolving 2D Saint-Venant shallow water equations at 60 frames per second. Dynamic slope advection and boundary foam damping compute in real time."
    },
    {
        "id": "seg3_debris_surge",
        "start": 63.0,
        "rate": "+4%",
        "text": "Activating the 2021 Chamoli GLOF scenario triggers our coupled non-Newtonian debris solver, computing a devastating 2.10x bulking amplification. Our dynamic 4D surge scrubber steps forward through time, tracking dynamic stage rise and velocity crests cell by cell down the gorge as the wave crests toward Tapovan barrage."
    },
    {
        "id": "seg4_nvidia_nebius",
        "start": 98.5,
        "rate": "+5%",
        "text": "Opening our Nebius HPC Telemetry HUD reveals an enterprise GPU pipeline. We trained a 2D Navier-Stokes PINN using NVIDIA Modulus Core, compiled it with TensorRT 10, and deployed it on an NVIDIA Triton Server on Nebius AI Cloud with 8 H100 GPUs. Total P99 latency is just 3.78 milliseconds—31 times faster than dual Xeon CPUs!"
    },
    {
        "id": "seg5_multisource_sitrep",
        "start": 118.0,
        "rate": "+5%",
        "text": "Our Multi-Source Data Fusion Cockpit ingests live radar from IMD, INSAT-3DR satellite telemetry, and CWC river gauges, dynamically re-weighting sensors via Kalman-Bayesian fusion, while synthesizing official NDRF situation reports."
    },
    {
        "id": "seg6_cap_lora",
        "start": 132.5,
        "rate": "+5%",
        "text": "When mobile networks drown, our 865 megahertz LoRa mesh engine packs alerts into 32-byte telemetry and 48-byte evacuation bursts, broadcasting multilingual OASIS CAP alerts in English, Hindi, and Garhwali VHF audio. Alaknanda C2: mission ready for the Himalayas."
    }
]

async def main():
    os.makedirs("audio_segments_timed", exist_ok=True)
    for seg in SEGMENTS:
        communicate = edge_tts.Communicate(seg["text"], voice="en-US-ChristopherNeural", rate=seg["rate"], pitch="-1Hz")
        out_path = f"audio_segments_timed/{seg['id']}.mp3"
        await communicate.save(out_path)
        
        res = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", out_path
        ], capture_output=True, text=True)
        dur = float(res.stdout.strip())
        print(f"[{seg['id']}] start={seg['start']}s, dur={dur:.2f}s, end={seg['start']+dur:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
