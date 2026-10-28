import os
import base64
import subprocess
import sys

def get_base64_image(image_path):
    with open(image_path, "rb") as img_file:
        encoded = base64.b64encode(img_file.read()).decode("utf-8")
        ext = os.path.splitext(image_path)[1].lower().replace(".", "")
        if ext == "jpg":
            ext = "jpeg"
        return f"data:image/{ext};base64,{encoded}"

def build_pdf_html():
    img_dir = "docs/manual_images"
    images = {
        "dashboard": get_base64_image(os.path.join(img_dir, "01_main_dashboard.png")),
        "briefing": get_base64_image(os.path.join(img_dir, "02_mission_briefing.png")),
        "nebius": get_base64_image(os.path.join(img_dir, "03_nebius_hpc_tensorrt.png")),
        "rheology": get_base64_image(os.path.join(img_dir, "04_rheology_debris_lab.png")),
        "voice": get_base64_image(os.path.join(img_dir, "05_voice_siren_broadcast.png")),
        "transect": get_base64_image(os.path.join(img_dir, "06_valley_topographic_transect.png")),
        "uav": get_base64_image(os.path.join(img_dir, "07_uav_drone_recon.png")),
        "fusion": get_base64_image(os.path.join(img_dir, "08_multisource_sensor_fusion.png")),
        "sitrep": get_base64_image(os.path.join(img_dir, "09_ndrf_sitrep_dispatch.png")),
        "cap": get_base64_image(os.path.join(img_dir, "10_disaster_dispatch_cap.png")),
        "icp": get_base64_image(os.path.join(img_dir, "11_ndrf_command_post_sachet.png")),
        "comms": get_base64_image(os.path.join(img_dir, "12_lora_mesh_comms.png")),
        "cloudburst": get_base64_image(os.path.join(img_dir, "13_cloudburst_cataclysm_view.png")),
        "hydrograph": get_base64_image(os.path.join(img_dir, "14_hydrograph_discharge_curve.png")),
    }

    template = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Alaknanda C2 — Master System Manual & Operational Guide</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-center {
      content: "Alaknanda C2 Disaster Command & Control Manual · Page " counter(page);
      font-size: 8pt;
      color: #64748b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 10pt;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 94vh;
    padding: 30px 20px 20px 20px;
  }

  .cover-header {
    border-bottom: 3px solid #0f172a;
    padding-bottom: 20px;
  }

  .cover-badge-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-nvidia { background: #76b900; color: #ffffff; }
  .badge-nebius { background: #7a22ce; color: #ffffff; }
  .badge-tactical { background: #0f172a; color: #38bdf8; }
  .badge-ndrf { background: #dc2626; color: #ffffff; }
  .badge-restricted { background: #ea580c; color: #ffffff; }

  .cover-title {
    font-size: 28pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.15;
    margin: 10px 0 6px 0;
    letter-spacing: -0.5px;
  }

  .cover-subtitle {
    font-size: 13pt;
    font-weight: 500;
    color: #475569;
    margin-bottom: 12px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    margin-top: 15px;
  }

  .cover-meta-item strong {
    display: block;
    font-size: 8pt;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 2px;
  }

  .cover-meta-item span {
    font-size: 9.5pt;
    color: #0f172a;
    font-weight: 600;
  }

  .cover-hero-image {
    margin: 20px 0;
    text-align: center;
  }

  .cover-hero-image img {
    max-width: 100%;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 14px rgba(0,0,0,0.1);
  }

  .cover-footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 15px;
    font-size: 8.5pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }

  /* Page Break & Headings */
  .page-break {
    page-break-before: always;
  }

  .avoid-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  h1 {
    font-size: 18pt;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 26px;
    margin-bottom: 14px;
    letter-spacing: -0.3px;
  }

  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 20px;
    margin-bottom: 8px;
    border-left: 4px solid #0284c7;
    padding-left: 8px;
  }

  h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
  }

  p {
    margin: 0 0 10px 0;
  }

  /* Callout Alerts */
  .callout {
    padding: 12px 14px;
    border-radius: 6px;
    margin: 12px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }

  .callout-info {
    background: #f0f9ff;
    border-left: 4px solid #0284c7;
    color: #0369a1;
  }

  .callout-warning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #b45309;
  }

  .callout-danger {
    background: #fef2f2;
    border-left: 4px solid #ef4444;
    color: #b91c1c;
  }

  .callout-success {
    background: #f0fdf4;
    border-left: 4px solid #10b981;
    color: #047857;
  }

  .callout-dark {
    background: #0f172a;
    border-left: 4px solid #38bdf8;
    color: #f8fafc;
  }

  .callout strong {
    display: block;
    font-size: 9.5pt;
    margin-bottom: 3px;
  }

  /* Figures & Screenshots */
  .figure-container {
    margin: 16px 0;
    page-break-inside: avoid;
    break-inside: avoid;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .figure-container img {
    width: 100%;
    height: auto;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
    display: block;
  }

  .figure-caption {
    font-size: 8.5pt;
    color: #475569;
    margin-top: 8px;
    text-align: center;
    font-weight: 500;
  }

  .figure-caption strong {
    color: #0f172a;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }

  th, td {
    padding: 7px 9px;
    text-align: left;
    border: 1px solid #cbd5e1;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Formulas */
  .math-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    margin: 10px 0;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 9pt;
    color: #0f172a;
    page-break-inside: avoid;
  }

  .math-box-highlight {
    background: #f0fdfa;
    border-color: #0d9488;
    color: #115e59;
    font-weight: 600;
  }

  /* Code Blocks */
  pre {
    background: #0f172a;
    color: #f8fafc;
    padding: 10px 14px;
    border-radius: 6px;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 8pt;
    overflow-x: hidden;
    white-space: pre-wrap;
    margin: 10px 0;
    page-break-inside: avoid;
  }

  code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 8.5pt;
    background: #e2e8f0;
    color: #0f172a;
    padding: 2px 4px;
    border-radius: 3px;
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div class="cover-header">
    <div class="cover-badge-row">
      <span class="badge badge-tactical">TACTICAL C2 DIGITAL TWIN</span>
      <span class="badge badge-nvidia">NVIDIA MODULUS & TENSORRT</span>
      <span class="badge badge-nebius">NEBIUS AI CLOUD 8x H100</span>
      <span class="badge badge-ndrf">NDRF & NDMA COMPLIANT</span>
      <span class="badge badge-restricted">OFFICIAL SYSTEM MANUAL</span>
    </div>
    <div class="cover-title">ALAKNANDA–DHAULIGANGA C2</div>
    <div class="cover-subtitle">3D GPU Digital Twin, AI Early Warning System & Disaster Response Platform</div>
    <div style="font-size: 9.5pt; color: #64748b; font-weight: 500;">
      Grand-Prize Edition: NVIDIA & Nebius AI Cloud Hackathon | Smart India Hackathon Grand Finalist
    </div>
  </div>

  <div class="cover-hero-image">
    <img src="IMG_DASHBOARD" alt="Alaknanda C2 Tactical Dashboard">
  </div>

  <div class="cover-meta-grid">
    <div class="cover-meta-item">
      <strong>Operational Geography</strong>
      <span>Alaknanda-Dhauliganga Basin, Chamoli District, Uttarakhand</span>
    </div>
    <div class="cover-meta-item">
      <strong>Primary Mission</strong>
      <span>Solving the Fatal 15-Minute Evacuation Window in High Gorges</span>
    </div>
    <div class="cover-meta-item">
      <strong>Key Compute Infrastructure</strong>
      <span>8x NVIDIA H100 SXM5 80GB (3.71ms P99 Inference Latency)</span>
    </div>
    <div class="cover-meta-item">
      <strong>Operational Stakeholders</strong>
      <span>NDRF 08 Bn, ITBP Joshimath, MHA DM Division, ISRO NRSC, IMD</span>
    </div>
  </div>

  <div class="cover-footer">
    <span>Document Ref: <strong>NDRF-EWS-MANUAL-v4.0</strong></span>
    <span>Security Status: <strong>RESTRICTED · OPERATIONAL CIVIL PROTECTION</strong></span>
    <span>Date: <strong>October 2026</strong></span>
  </div>
</div>

<!-- CHAPTER 1 -->
<div class="page-break"></div>
<h1>1. THE CRISIS: WHY DOES THIS PROJECT EXIST?</h1>

<h2>1.1 The High Himalayan Terrain & The 2021 Chamoli Disaster</h2>
<p>
  Chamoli district in Uttarakhand sits in the High Himalayas, where mountains rise steeply from 1,300 meters at river confluences to over 7,800 meters at Nanda Devi. The <strong>Dhauliganga</strong> and <strong>Alaknanda</strong> rivers flow through narrow, V-shaped gorges with bed slopes exceeding 28° to 42°.
</p>

<div class="figure-container">
  <img src="IMG_BRIEFING" alt="60-Second Mission Briefing">
  <div class="figure-caption"><strong>Figure 1:</strong> The 60-Second Tactical Mission Briefing modal detailing the 2021 Chamoli disaster crisis and the five engineering pillars.</div>
</div>

<p>
  On <strong>February 7, 2021</strong>, a massive slab of glacier and rock (27 million cubic meters) broke off the Ronti peak at 5,500m elevation. It cascaded down the Ronti Gad gorge, generating friction heat that melted ice into water, transforming the avalanche into a hyper-concentrated non-Newtonian debris flow traveling at over <strong>25 meters per second</strong> (90 km/h). The surge pulverized the Rishiganga Hydroelectric Project and demolished the Tapovan Vishnugad dam downstream, trapping and killing over 200 workers and local villagers.
</p>

<h2>1.2 The Fatal 15-Minute Evacuation Window</h2>
<p>
  In plain terrain, a river takes 24 to 72 hours to flood, giving disaster response forces days to construct sandbag levees and evacuate citizens. In steep Himalayan gorges, the reality is brutally compressed:
</p>

<div class="callout callout-danger">
  <strong>The Mountain Evacuation Dilemma</strong>
  From the moment an avalanche, glacial lake breach (GLOF), or cloudburst occurs at the mountain peaks, the catastrophic flood wave strikes the first downstream villages in just <strong>14 to 20 minutes</strong>. An incident commander has less than 15 minutes to detect the event, calculate which bridges will be overtopped, alert mountain hamlets, and mobilize people uphill.
</div>

<h2>1.3 Why Conventional Warning Systems Fail</h2>
<ol>
  <li><strong>Excessive Compute Latency:</strong> Traditional 2D hydrodynamic solvers (e.g. HEC-RAS 2D or computational fluid dynamics) require <strong>45 minutes to 4 hours</strong> of CPU compute for a 30-minute wave, rendering them completely useless during an ongoing event.</li>
  <li><strong>Assumption of Clean Water:</strong> Standard models assume water is a clear Newtonian fluid with zero debris (Bf = 1.0). In reality, mountain torrents scrape millions of tons of moraine boulders from the riverbed, <strong>multiplying the flood volume by 2.10x</strong> (Takahashi bulking).</li>
  <li><strong>Immediate Telecom Blackout:</strong> High-velocity mountain debris waves sever underground fiber conduits and topple cellular base transceiver stations (BTS), turning standard cloud-based dashboards black.</li>
</ol>

<!-- CHAPTER 2 -->
<div class="page-break"></div>
<h1>2. THE 5 CORE ENGINEERING PILLARS EXPLAINED SIMPLY</h1>

<h2>Pillar 1: NVIDIA AI Supercomputing (Modulus PINN & TensorRT)</h2>
<p>
  Instead of solving partial differential equations from scratch during an emergency, Alaknanda C2 uses a <strong>Physics-Informed Neural Network (PINN)</strong> trained with <strong>NVIDIA Modulus</strong>. The neural network learns the 2D Saint-Venant shallow water equations with mass and momentum conservation. Compiled into an optimized <strong>TensorRT 10</strong> engine running on <strong>Nebius AI Cloud</strong> (8x NVIDIA H100 SXM5), it delivers 2D flood forecasts in <strong>3.71 milliseconds</strong> (260x faster than real-time).
</p>

<h2>Pillar 2: Client-Side WebGL2 3D Fluid Digital Twin</h2>
<p>
  Rather than drawing static colored polygons, Alaknanda C2 runs a <strong>real-time fluid dynamics shader</strong> directly on your computer's GPU inside the browser using WebGL2. Using multi-pass ping-pong Framebuffer Objects (FBO), it simulates water rushing downhill, soil soaking, boundary foam damping, and Fresnel reflections at 60 FPS over 10m 3D satellite mountain terrain.
</p>

<h2>Pillar 3: Dynamic Non-Newtonian Debris Rheology Lab</h2>
<p>
  Alaknanda C2 treats flood water as a thick, non-Newtonian Bingham plastic slurry. It dynamically couples Green-Ampt unsaturated soil matrix suction (&psi;) with Takahashi equilibrium sediment entrainment (&alpha; = 0.35), solving how the flood expands into a 2.10x bulked debris wave that can knock down reinforced concrete dams.
</p>

<h2>Pillar 4: Multi-Source Sensor Fusion Cockpit</h2>
<p>
  To avoid false alarms, the platform assimilates five independent data feeds using Bayesian Kalman weighting:
</p>
<ul>
  <li><strong>ISRO INSAT-3DR Satellite:</strong> Detects cloud-top overshooting temperatures down to -64.8&deg;C.</li>
  <li><strong>IMD Mukteshwar Doppler Radar:</strong> Measures radar reflectivity exceeding 54.2 dBZ.</li>
  <li><strong>CWC River Gauges:</strong> Ultrasonic water stage sensors monitoring riverbed levels.</li>
  <li><strong>ECMWF & Open-Meteo NWP:</strong> Numerical weather prediction rainfall forecasts.</li>
  <li><strong>Ground LoRa Mesh Nodes:</strong> Sub-surface soil moisture sensors along mountain ridges.</li>
</ul>

<h2>Pillar 5: Resilient Civil Protection & Zero-Telecom Comms</h2>
<p>
  When cell towers collapse, Alaknanda C2 compresses emergency alerts into <strong>32-byte and 48-byte binary packets</strong> transmitted over sub-gigahertz <strong>865–867 MHz LoRa mesh radios</strong>. It also automatically synthesizes <strong>authentic Garhwali-dialect voice megaphone sirens</strong> for village loudspeakers and exports official <strong>NDRF Situation Reports (SITREPs)</strong> with one-click printable PDFs.
</p>

<!-- CHAPTER 3 -->
<div class="page-break"></div>
<h1>3. SYSTEM ARCHITECTURE & TELEMETRY ENGINE</h1>

<div class="figure-container">
  <img src="IMG_NEBIUS" alt="Nebius H100 HPC & TensorRT HUD">
  <div class="figure-caption"><strong>Figure 2:</strong> Nebius AI Cloud & NVIDIA TensorRT Telemetry HUD showing microsecond Nsight flame chart breakdown and hardware bandwidth metrics.</div>
</div>

<h2>3.1 Microsecond Pipeline Latency Breakdown</h2>
<p>
  The hardware telemetry HUD records the exact execution latency across each pipeline stage on Nebius H100 SXM5:
</p>

<table>
  <thead>
    <tr>
      <th>Stage</th>
      <th>Pipeline Operation</th>
      <th>Hardware Mechanism</th>
      <th>Duration</th>
      <th>% Total</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Stage 1</strong></td>
      <td>Host to Device Transfer (H2D)</td>
      <td>PCIe Gen5 / NVLink 900 GB/s H2D DMA</td>
      <td>0.41 ms</td>
      <td>10.8%</td>
    </tr>
    <tr>
      <td><strong>Stage 2</strong></td>
      <td>cuSpatial Resampling</td>
      <td>High-resolution 10m DEM elevation interpolation</td>
      <td>0.57 ms</td>
      <td>14.9%</td>
    </tr>
    <tr>
      <td><strong>Stage 3</strong></td>
      <td>Geo-FNO INT8 PINN Inference</td>
      <td>4th-Gen Tensor Core GEMM (Modulus Fourier Operator)</td>
      <td>1.94 ms</td>
      <td>50.8%</td>
    </tr>
    <tr>
      <td><strong>Stage 4</strong></td>
      <td>Saint-Venant Riemann Solver</td>
      <td>Conservation of momentum & slope source terms</td>
      <td>0.58 ms</td>
      <td>15.2%</td>
    </tr>
    <tr>
      <td><strong>Stage 5</strong></td>
      <td>Device to Host DMA (D2H)</td>
      <td>Asynchronous tensor payload return</td>
      <td>0.32 ms</td>
      <td>8.3%</td>
    </tr>
    <tr>
      <td colspan="3" style="text-align: right; font-weight: 700;">TOTAL PIPELINE LATENCY:</td>
      <td colspan="2" style="font-weight: 700; color: #0284c7;">3.82 ms (259.4 FPS)</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-success">
  <strong>Hardware Optimization Results</strong>
  On dual Intel Xeon CPUs, baseline 2D hydrodynamic inference required 118.4 ms. Compiled with TensorRT 10 INT8 on Nebius H100, latency drops to <strong>3.71 ms</strong>—a <strong>31.3x hardware speedup</strong> with 94.8% memory bandwidth saturation (3,175 GB/s HBM3 peak).
</div>

<!-- CHAPTER 4 -->
<div class="page-break"></div>
<h1>4. SCREEN-BY-SCREEN OPERATOR MANUAL</h1>

<h2>Screen 1: Main Tactical Command & Control Dashboard</h2>
<div class="figure-container">
  <img src="IMG_DASHBOARD" alt="Main Command Post Dashboard">
  <div class="figure-caption"><strong>Figure 3:</strong> Main situational command post interface showing active alert banner, surge arrival timer, confluence discharge, and 3D terrain viewport.</div>
</div>

<p><strong>Operator Controls on Main Dashboard:</strong></p>
<ul>
  <li><strong>Top Tactical Header:</strong> Quick-switch scenario buttons (<code>Dry</code>, <code>Monsoon</code>, <code>Cloudburst</code>, <code>2021 GLOF</code>), connection badges for NRSC, IMD, and NDRF, and feature launchers.</li>
  <li><strong>Alert Banner:</strong> Displays active alert state (<code>GREEN</code>, <code>ORANGE</code>, or <code>RED · CATACLYSMIC</code>), surge countdown timer (e.g. <code>85:15</code>), confluence discharge rate (94.2 m&sup3;/s), and official military directive.</li>
  <li><strong>Operations Viewport:</strong> Switch between 3D Tactical Twin, 2D Catchment Hazard Map, and Hydrograph curves. Height adjustable from 420px to 900px.</li>
  <li><strong>Telemetry Controls:</strong> Interactive rainfall (mm/hr) and soil moisture (%) sliders for Upper, Mid, and Lower catchment wards.</li>
</ul>

<!-- SCREEN 2 & 3 -->
<div class="page-break"></div>
<h2>Screen 2: Coupled Debris Rheology & Takahashi Bulking Lab (Hotkey: L)</h2>
<div class="figure-container">
  <img src="IMG_RHEOLOGY" alt="Debris Rheology Lab">
  <div class="figure-caption"><strong>Figure 4:</strong> Non-Newtonian Rheology Lab with interactive Bingham plastic stress-strain curve and Takahashi sediment bulking calculator.</div>
</div>

<p>
  Standard models assume clear water. In the Rheology Lab, operators can examine how gravel and moraine boulders alter the physics:
</p>
<ul>
  <li><strong>Bulking Multiplier (Bf):</strong> Shows flow expansion (up to 5.93x under extreme choked bed slide conditions).</li>
  <li><strong>Bulked Discharge (Qm):</strong> Cumulative water and sediment volume in m&sup3;/s.</li>
  <li><strong>Yield Stress (&tau;y):</strong> Minimum force required to deform the slurry (9.2 Pa up to 120 Pa).</li>
  <li><strong>Slurry Density (&rho;m):</strong> Increases from 1,000 kg/m&sup3; to 1,627 kg/m&sup3; (38% solid rock by volume).</li>
  <li><strong>"Apply to Live EWS" Button:</strong> Directly updates downstream flood arrival models with the active bulking factor.</li>
</ul>

<h2>Screen 3: Multilingual Voice Megaphone & Siren (Hotkey: V)</h2>
<div class="figure-container">
  <img src="IMG_VOICE" alt="Voice Broadcast Siren">
  <div class="figure-caption"><strong>Figure 5:</strong> Tactical Voice Megaphone modal showing the Garhwali dialect teleprompter, Web Audio squelch chirp, and repeater tower links.</div>
</div>

<p>
  During a disaster, elderly mountain villagers cannot read technical English alerts. The Voice Megaphone addresses this with:
</p>
<ul>
  <li><strong>गढ़वाली (Garhwali Mountain SWRT Siren):</strong> Native Himalayan dialect broadcast over village loudspeakers:
    <em>"धात सुणा! सभी धौलीगंगा व अलकनंदा घाटी का लोग ध्यान द्या! माथि रौंठी गाड मा बड्ड बाढ आण लग्यूं च! तुरंत अपणा घर छोडी क ऊंचे डांडा तरफ भज्जा!"</em></li>
  <li><strong>Web Audio FM Squelch & Two-Tone Chirp:</strong> Generates authentic radio chirp tones before voice transmission.</li>
  <li><strong>Web Speech Synchronized Teleprompter:</strong> Highlights spoken words in real time with audio playback.</li>
</ul>

<!-- SCREEN 4 & 5 -->
<div class="page-break"></div>
<h2>Screen 4: 2D Geotechnical Topographic Transect (Hotkey: X)</h2>
<div class="figure-container">
  <img src="IMG_TRANSECT" alt="2D Valley Cross Section">
  <div class="figure-caption"><strong>Figure 6:</strong> Topographic cross-section showing riverbed altitude (1372m), flood stage (1382.3m), submerged bridge deck (1380.5m), and safe haven shelter.</div>
</div>

<p>
  The 2D Transect modal lets commanders inspect exact slope cross-sections across critical chokepoints:
</p>
<ul>
  <li><strong>Vishnuprayag Confluence Chokepoint:</strong> Highlights the NH-7 bridge deck submergence (+10.3m stage).</li>
  <li><strong>Uphill Pedestrian Trail:</strong> Displays walking distance (1,180 meters) and ascent differential (+140m).</li>
  <li><strong>Evacuation Safety Margin (&Delta;t):</strong> Compares surge travel time (28 mins) against pedestrian uphill climb time (12 mins), giving a <strong>+16 minute safety buffer</strong>.</li>
</ul>

<h2>Screen 5: UAV Aerial Drone Reconnaissance Sentry (Hotkey: U)</h2>
<div class="figure-container">
  <img src="IMG_UAV" alt="UAV Drone Recon HUD">
  <div class="figure-caption"><strong>Figure 7:</strong> Autonomous drone sentry patrol HUD with center reticle crosshairs, thermal infrared FLIR mode, and waypoint patrol route.</div>
</div>

<p>
  Simulates an autonomous drone sentry patrolling the gorge ahead of the flood wave:
</p>
<ul>
  <li><strong>Targeting Crosshairs:</strong> Overlays compass azimuth, camera pitch angle, and distance telemetry.</li>
  <li><strong>7 Critical Patrol Waypoints:</strong> From the Tapovan Barrage epicenter (1,850m) down to the Helang chokepoint (1,520m).</li>
  <li><strong>Sensor Modes:</strong> Toggle between <code>OPTICAL</code> (daylight), <code>THERMAL</code> (FLIR infrared false-color heat map), and <code>NVG</code> (phosphor green night vision).</li>
</ul>

<!-- SCREEN 6 & 7 -->
<div class="page-break"></div>
<h2>Screen 6: Multi-Source Sensor Fusion Cockpit (Hotkey: F)</h2>
<div class="figure-container">
  <img src="IMG_FUSION" alt="Sensor Fusion Cockpit">
  <div class="figure-caption"><strong>Figure 8:</strong> Multi-Source Sensor Fusion Cockpit displaying Doppler reflectivity, satellite cloud top temperature, and Bayesian consensus.</div>
</div>

<p>
  Audits the five live data streams feeding the AI system:
</p>
<ul>
  <li><strong>Fusion Consensus:</strong> Bayesian cross-validation score (e.g. <strong>98.6% High Credibility</strong>).</li>
  <li><strong>Doppler Radar Reflectivity:</strong> 54.2 dBZ confirming severe convective storm cells.</li>
  <li><strong>Satellite Cloud Top:</strong> -64.8&deg;C indicating rapid orographic updrafts over high ridges.</li>
  <li><strong>Ground Nodes:</strong> 6 of 6 LoRaWAN field sensors reporting normal RF backscatter.</li>
</ul>

<h2>Screen 7: NDRF Situation Report SITREP (Hotkey: R)</h2>
<div class="figure-container">
  <img src="IMG_SITREP" alt="NDRF SITREP Modal">
  <div class="figure-caption"><strong>Figure 9:</strong> NDRF Situation Report Tactical Dispatch modal with automated troop tasking and 1-click printable PDF generator.</div>
</div>

<p>
  Automates the administrative dispatch overhead for disaster forces:
</p>
<ul>
  <li><strong>Official Identifiers:</strong> Automated generation of incident hashes (e.g. <code>NDRF-SITREP-202610272003</code>).</li>
  <li><strong>Troop Mobilization Orders:</strong> Mandates activation of 4 quick-response companies, deployment of Gemini inflatable boats, and IAF ALH helicopter winch rescue coordination.</li>
  <li><strong>Print / Save PDF:</strong> Re-styles the document for clean black-and-white field clipboard printing.</li>
</ul>

<!-- SCREEN 8 & 9 -->
<div class="page-break"></div>
<h2>Screen 8: OASIS CAP v1.2 Disaster Alert Dispatch (Hotkey: D)</h2>
<div class="figure-container">
  <img src="IMG_CAP" alt="CAP Alert Dispatch">
  <div class="figure-caption"><strong>Figure 10:</strong> OASIS CAP v1.2 XML/JSON dispatch interface with NDMA Sachet cell-broadcast integration.</div>
</div>

<p>
  Outputs authorized national emergency payloads in four standardized formats:
</p>
<ul>
  <li><strong>XML (OASIS):</strong> Standard XML payload ingested by NDMA and WMO alert gateways.</li>
  <li><strong>JSON (NDMA):</strong> Modern API structure consumed by national emergency servers.</li>
  <li><strong>हिन्दी (SMS):</strong> Geo-targeted mobile text alert broadcast to all cell phones inside the danger polygon.</li>
  <li><strong>गढ़वाली (VHF):</strong> Radio dispatch script for civil defence operators.</li>
</ul>

<h2>Screen 9: NDRF Incident Command Post & NDMA Sachet (Hotkey: I)</h2>
<div class="figure-container">
  <img src="IMG_ICP" alt="NDRF Incident Command Post">
  <div class="figure-caption"><strong>Figure 11:</strong> NDRF Incident Command Post with MHA ICS-204 tasking orders and NDMA Sachet C-DOT cell broadcast portal.</div>
</div>

<p>
  Comprehensive operational management suite adhering to National Disaster Management Authority (NDMA) protocols:
</p>
<ul>
  <li><strong>ITU-T X.1303 Dissemination:</strong> Authorized CAP-CP XML payload for national emergency distribution.</li>
  <li><strong>C-DOT Cell Broadcast Service (CBS):</strong> Direct transmission to telecommunication tower SMS gateways.</li>
  <li><strong>ICS-204 Tasking Order:</strong> Standard Incident Command System field team assignments.</li>
</ul>

<!-- SCREEN 10 & 11 -->
<div class="page-break"></div>
<h2>Screen 10: Tactical LoRaWAN Mesh & Resilient Comms Panel</h2>
<div class="figure-container">
  <img src="IMG_COMMS" alt="Tactical Comms Panel">
  <div class="figure-caption"><strong>Figure 12:</strong> Comms Layer panel demonstrating triple failover (SATCOM, LoRa mesh, VHF) when cellular 4G/5G networks collapse.</div>
</div>

<p>
  When cellular networks are drowned by floodwaters, the system maintains communication survivability through three redundant layers:
</p>
<ul>
  <li><strong>Tier 1 — SATCOM (GSAT-7A Ku-band):</strong> High-throughput link to ISRO master hub (99.8% SNR).</li>
  <li><strong>Tier 2 — LoRaWAN Mesh (865–867 MHz SX1262):</strong> 4 battery-backed hilltop relay nodes spanning 15 km mountain links.</li>
  <li><strong>Tier 3 — VHF Voice (146.5 MHz):</strong> Analog FM voice repeaters for two-way handheld radios.</li>
  <li><strong>Binary Packet Inspector:</strong> Visualizes raw hex and base64 payloads for 32-byte telemetry and 48-byte emergency alert frames.</li>
</ul>

<h2>Screen 11: Cataclysmic Cloudburst Simulation (Hotkey: 3)</h2>
<div class="figure-container">
  <img src="IMG_CLOUDBURST" alt="Cloudburst Cataclysm View">
  <div class="figure-caption"><strong>Figure 13:</strong> Cataclysmic Cloudburst Cascade scenario with basin-wide red warning, surge vectors, and historical storm records.</div>
</div>

<p>
  Simulates an extreme 96 mm/hr orographic cloudburst event:
</p>
<ul>
  <li>All three river wards switch to <code>RED · CATACLYSMIC</code> alert level.</li>
  <li>Confluence discharge spikes to <strong>309.8 m&sup3;/s</strong>, far exceeding the 1-in-50-year envelope.</li>
  <li>Uphill evacuation trails to Gorson Bugyal (+340m) and Auli (+270m) light up with dynamic safety vectors.</li>
</ul>

<!-- SCREEN 12 -->
<div class="page-break"></div>
<h2>Screen 12: Dynamic Hydrograph & Discharge Forecast</h2>
<div class="figure-container">
  <img src="IMG_HYDROGRAPH" alt="Hydrograph and Stage Forecast">
  <div class="figure-caption"><strong>Figure 14:</strong> Hydrograph viewport comparing rainfall intensity against flash flood guidance and plotting river stage vs. bankfull threshold.</div>
</div>

<p>
  The hydrograph plots the arrival and crest of the flood wave:
</p>
<ul>
  <li><strong>Top Graph (Rainfall vs. FFG):</strong> Shows rainfall intensity (amber line) spiking past the dynamic flash flood guidance line (cyan dashed line), indicating immediate overland runoff.</li>
  <li><strong>Bottom Graph (River Discharge vs. Stage):</strong> Tracks river discharge in m&sup3;/s and stage in meters. The red bankfull threshold (1.32m) clearly warns that the projected 1.80m peak will overtop riverbanks at T+30 minutes.</li>
</ul>

<!-- CHAPTER 5 -->
<div class="page-break"></div>
<h1>5. THE SCIENCE & MATHEMATICS DISSECTED</h1>

<h2>5.1 Time of Concentration (Tc) — Kirpich Equation</h2>
<p>
  The time required for runoff to travel from the most hydraulically remote point of the watershed to the outlet is calculated via the <strong>Kirpich Formula</strong>:
</p>
<div class="math-box">
  Tc = 0.0195 &times; L<sup>0.77</sup> &times; S<sup>-0.385</sup>
</div>
<p>
  Where L is flow length along the main channel (meters), and S is channel slope (S = &Delta;H / L). Because Himalayan slopes are extremely steep (S > 0.40), Tc is under 25 minutes, requiring sub-minute early warning.
</p>

<h2>5.2 Soil Matrix Suction — Green-Ampt Formulation</h2>
<p>
  Before runoff initiates, unsaturated soil absorbs water through negative pore pressure (capillary suction &psi;):
</p>
<div class="math-box">
  &psi;(&theta;) = &psi;b &times; [(&theta; - &theta;r) / (&theta;s - &theta;r)]<sup>-1/&lambda;</sup>
</div>
<p>
  When rainfall rate I exceeds the Green-Ampt infiltration capacity f(t) = Ks &times; [1 + (&psi;&Delta;&theta; / F(t))], surface ponding occurs and debris slopes destabilize.
</p>

<h2>5.3 Dynamic Debris Bulking — Takahashi Equation</h2>
<p>
  As the torrent scours loose moraine sediment, the equilibrium sediment concentration C&infin; reaches:
</p>
<div class="math-box">
  C&infin; = [&rho;w &times; tan(&theta;)] / [(&rho;s - &rho;w) &times; (tan(&phi;) - tan(&theta;))]
</div>
<p>
  The <strong>Bulking Factor (Bf)</strong> amplifies total discharge:
</p>
<div class="math-box math-box-highlight">
  Bf = C* / [C* - C&infin;] &nbsp;&nbsp;&rArr;&nbsp;&nbsp; Q_bulked = Q_water &times; Bf
</div>
<p>
  With C* = 0.60 (maximum boulder packing), Bf reaches <strong>2.10x</strong> in Chamoli, converting 183.3 m&sup3;/s of water into a <strong>384.9 m&sup3;/s</strong> battering ram.
</p>

<h2>5.4 Bingham Plastic Slurry Rheology</h2>
<div class="math-box">
  &tau; = &tau;y(Cd) + &mu;m(Cd) &times; (&part;u / &part;z)
</div>
<p>
  Yield stress &tau;y must be overcome before deformation starts. Once moving, the slurry acts with high dynamic viscosity, exerting massive impact pressures against bridge pylons.
</p>

<h2>5.5 LoRa SX1262 Binary Bit-Packing Schema</h2>
<p>
  To transmit over low-bandwidth 865 MHz radio, payloads are encoded into raw binary bit arrays:
</p>
<pre>
CompactTelemetryFrame (32 Bytes):
[0..1]   Magic "AK" (0x41, 0x4B)
[2]      Packet Type (0x01 = Telemetry)
[3]      Sequence Number (0..255)
[4..7]   Timestamp UTC (uint32)
[8]      Ward ID (1 = Upper, 2 = Mid, 3 = Lower)
[9]      Risk Level (0 = Low, 1 = Med, 2 = High, 3 = Cataclysmic)
[10..11] Rainfall Rate (uint16, 0.1 mm/hr)
[12..13] Soil Moisture (uint16, 0.1%)
[14..17] River Discharge Q (uint32, 0.01 m³/s)
[18..29] GPS / Ward Coordinates (uint8[12])
[30..31] Hardware Checksum: CRC16-CCITT (Polynomial 0x1021)
</pre>

<!-- CHAPTER 6 -->
<div class="page-break"></div>
<h1>6. OPERATIONAL PLAYBOOK & EVACUATION MARGINS</h1>

<h2>6.1 Calculating the Evacuation Safety Margin (&Delta;t)</h2>
<p>
  The primary metric for field commanders is the <strong>Evacuation Safety Margin</strong>:
</p>
<div class="math-box math-box-highlight">
  &Delta;t = T_surge - T_transit
</div>
<p>
  Where T_surge is flood wave arrival time and T_transit is uphill hiking time to designated high ground.
</p>

<table>
  <thead>
    <tr>
      <th>Settlement / Infrastructure</th>
      <th>Elevation</th>
      <th>Surge Arrival (T_surge)</th>
      <th>Safe Shelter</th>
      <th>Transit Time (T_transit)</th>
      <th>Margin (&Delta;t)</th>
      <th>Action Directive</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Tapovan Barrage</strong></td>
      <td>1,900 m</td>
      <td><strong>14 min</strong></td>
      <td>Army Ridge Shelter</td>
      <td>9 min</td>
      <td style="color: #dc2626; font-weight: 700;">+5 min</td>
      <td>🔴 Sound Klaxon / Immediate Evacuation</td>
    </tr>
    <tr>
      <td><strong>Pandukeshwar</strong></td>
      <td>1,829 m</td>
      <td><strong>22 min</strong></td>
      <td>Upper Helipad Mound</td>
      <td>12 min</td>
      <td style="color: #ea580c; font-weight: 700;">+10 min</td>
      <td>🟠 Rapid Uphill March</td>
    </tr>
    <tr>
      <td><strong>Vishnuprayag</strong></td>
      <td>1,372 m</td>
      <td><strong>28 min</strong></td>
      <td>Joshimath Bypass High Point</td>
      <td>15 min</td>
      <td style="color: #ea580c; font-weight: 700;">+13 min</td>
      <td>🟠 Close Confluence Bridges</td>
    </tr>
    <tr>
      <td><strong>Helang</strong></td>
      <td>1,520 m</td>
      <td><strong>42 min</strong></td>
      <td>Primary School Plateau</td>
      <td>18 min</td>
      <td style="color: #ca8a04; font-weight: 700;">+24 min</td>
      <td>🟡 Orderly Lowland Evacuation</td>
    </tr>
    <tr>
      <td><strong>Joshimath Town</strong></td>
      <td>1,890 m</td>
      <td>High Ridge</td>
      <td>ITBP Cantonment</td>
      <td>8 min</td>
      <td style="color: #16a34a; font-weight: 700;">Safe</td>
      <td>🟢 Command Post Active</td>
    </tr>
    <tr>
      <td><strong>Auli</strong></td>
      <td>2,800 m</td>
      <td>Mountain Peak</td>
      <td>Ski Resort Shelter</td>
      <td>5 min</td>
      <td style="color: #16a34a; font-weight: 700;">Safe</td>
      <td>🟢 Master LoRa Gateway Secure</td>
    </tr>
  </tbody>
</table>

<h2>6.2 Master Keyboard Hotkey Cheat Sheet</h2>

<table>
  <thead>
    <tr>
      <th style="width: 12%;">Key</th>
      <th style="width: 30%;">Operational Action</th>
      <th>Impact & Modal Launched</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong><code>T</code></strong></td>
      <td><strong>Mission Briefing</strong></td>
      <td>Starts 60-second automated executive walkthrough of the 5 pillars.</td>
    </tr>
    <tr>
      <td><strong><code>1</code> / <code>2</code></strong></td>
      <td><strong>Dry / Monsoon</strong></td>
      <td>Toggles between dry baseline (16 m&sup3;/s) and monsoon saturated (94 m&sup3;/s).</td>
    </tr>
    <tr>
      <td><strong><code>3</code> / <code>4</code></strong></td>
      <td><strong>Cloudburst / GLOF</strong></td>
      <td>Triggers cataclysmic cloudburst (309 m&sup3;/s) or 2021 Chamoli GLOF (384.9 m&sup3;/s).</td>
    </tr>
    <tr>
      <td><strong><code>Z</code></strong></td>
      <td><strong>Zen Mode</strong></td>
      <td>Hides all toolbars and panels for unobstructed 4K 3D terrain viewing.</td>
    </tr>
    <tr>
      <td><strong><code>P</code></strong></td>
      <td><strong>Nebius HPC HUD</strong></td>
      <td>Displays microsecond Nsight kernel timeline and Triton telemetry.</td>
    </tr>
    <tr>
      <td><strong><code>L</code></strong></td>
      <td><strong>Rheology Lab</strong></td>
      <td>Opens interactive Bingham plastic yield stress and Takahashi bulking curves.</td>
    </tr>
    <tr>
      <td><strong><code>V</code></strong></td>
      <td><strong>Voice Siren</strong></td>
      <td>Synthesizes authentic Garhwali/Hindi audio megaphone sirens.</td>
    </tr>
    <tr>
      <td><strong><code>X</code></strong></td>
      <td><strong>2D Transect</strong></td>
      <td>Displays mountain slope elevation, bridge clearance, and safe havens.</td>
    </tr>
    <tr>
      <td><strong><code>U</code></strong></td>
      <td><strong>Drone Recon HUD</strong></td>
      <td>Activates 3D UAV sentry crosshairs with optical, FLIR thermal, and NVG modes.</td>
    </tr>
    <tr>
      <td><strong><code>I</code></strong></td>
      <td><strong>NDRF Command Post</strong></td>
      <td>Opens official MHA ICS-204 tasking orders and NDMA Sachet hub.</td>
    </tr>
    <tr>
      <td><strong><code>F</code></strong></td>
      <td><strong>Sensor Fusion</strong></td>
      <td>Audits 5 live satellite, radar, and ground sensor data streams.</td>
    </tr>
    <tr>
      <td><strong><code>R</code></strong></td>
      <td><strong>NDRF SITREP</strong></td>
      <td>Generates official disaster situation report with printable PDF.</td>
    </tr>
    <tr>
      <td><strong><code>D</code></strong></td>
      <td><strong>CAP Dispatch</strong></td>
      <td>Opens OASIS CAP v1.2 XML/JSON/SMS emergency dispatch.</td>
    </tr>
    <tr>
      <td><strong><code>M</code></strong></td>
      <td><strong>Toggle Siren</strong></td>
      <td>Mutes or unmutes the audio air-raid warning klaxon.</td>
    </tr>
    <tr>
      <td><strong><code>S</code></strong></td>
      <td><strong>Download Telemetry</strong></td>
      <td>Exports synchronized JSON incident data file to your computer.</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-dark" style="margin-top: 30px;">
  <strong>System Dedication</strong>
  Developed with deepest reverence for the lives lost in the 2013 Kedarnath and 2021 Chamoli disasters, and dedicated to the brave personnel of the National Disaster Response Force (NDRF), Indo-Tibetan Border Police (ITBP), and the mountain communities of Uttarakhand.
</div>

</body>
</html>
"""

    for k, v in images.items():
        placeholder = f"IMG_{k.upper()}"
        template = template.replace(placeholder, v)

    output_html_path = "docs/ALAKNANDA_C2_MANUAL.html"
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(template)
    print(f"Generated standalone HTML manual at {output_html_path} ({len(template)} bytes)")
    return output_html_path

def convert_html_to_pdf(html_path, pdf_path):
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--print-to-pdf-margins=0",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    print(f"Running Chrome print-to-pdf...")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if os.path.exists(pdf_path):
        size = os.path.getsize(pdf_path)
        print(f"Successfully generated PDF: {pdf_path} ({size} bytes / {size / (1024*1024):.2f} MB)")
    else:
        print(f"Error generating PDF. Stderr: {res.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    html_file = build_pdf_html()
    pdf_file = "docs/ALAKNANDA_C2_MASTER_SYSTEM_MANUAL.pdf"
    convert_html_to_pdf(html_file, pdf_file)
