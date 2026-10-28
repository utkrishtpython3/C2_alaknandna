#!/bin/bash
# ==============================================================================
# ALAKNANDA C2: NEBIUS AI CLOUD MULTI-GPU DISTRIBUTED TRAINING LAUNCHER
# Production Slurm Batch Harness for NVIDIA Modulus 2D Geo-FNO PINN Training
# ==============================================================================
#SBATCH --job-name=alaknanda_nebius_h100
#SBATCH --partition=gpu-h100
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=8
#SBATCH --gpus=8
#SBATCH --gpus-per-node=8
#SBATCH --cpus-per-task=12
#SBATCH --constraint=h100-sxm5-80gb
#SBATCH --mem=0
#SBATCH --time=24:00:00
#SBATCH --output=logs/slurm_%x_%j.out
#SBATCH --error=logs/slurm_%x_%j.err

set -euo pipefail

# Create output log directory if missing
mkdir -p logs checkpoints

echo "=============================================================================="
echo " Starting Alaknanda C2 Distributed Training on Nebius AI Cloud"
echo " Node List: $SLURM_JOB_NODELIST"
echo " Allocated GPUs: $SLURM_GPUS_ON_NODE (Target: 8x H100 SXM5 80GB)"
echo " Start Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=============================================================================="

# ==============================================================================
# 1. INFINIBAND & NCCL ENTERPRISE HIGH-THROUGHPUT TUNING
# ==============================================================================
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=INIT,COLL,ENV
export NCCL_IB_DISABLE=0                    # Enforce high-speed InfiniBand fabric
export NCCL_NET_GDR_LEVEL=5                 # Enable GPUDirect RDMA over ConnectX-7 NICs
export NCCL_IB_GID_INDEX=3
export NCCL_IB_TC=106                       # RoCE / IB Traffic Class for QoS priority
export NCCL_CROSS_NIC=1
export NCCL_ALGO=RING,TREE                  # Rail-optimized collective algorithms
export CUDA_DEVICE_MAX_CONNECTIONS=1        # Maximizes concurrent kernel execution
export TORCH_DISTRIBUTED_DEBUG=DETAIL

# PyTorch 2.x CUDA Allocation Configuration (Avoids GPU SRAM Fragmentation)
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

# Load CUDA 12.x and OpenMPI HPC Toolchains
module load cuda/12.3 openmpi/4.1.5 || true

# Determine Master Node Coordinates
export MASTER_ADDR=$(scontrol show hostnames "$SLURM_JOB_NODELIST" | head -n 1)
export MASTER_PORT=29500

echo "[CLUSTER] InfiniBand GPUDirect RDMA configured. Master Rendezvous: $MASTER_ADDR:$MASTER_PORT"

# ==============================================================================
# 2. DISTRIBUTED EXECUTION HARNESS (PyTorch FSDP + AMP BFloat16)
# ==============================================================================
# Executes parallel worker processes across all 8 local H100 GPUs
srun --kill-on-bad-exit=1 \
     torchrun \
     --nproc_per_node=8 \
     --nnodes=$SLURM_JOB_NUM_NODES \
     --rdzv_id=$SLURM_JOB_ID \
     --rdzv_backend=c10d \
     --rdzv_endpoint="$MASTER_ADDR:$MASTER_PORT" \
     gpu_pipeline/models/modulus_swe_pinn.py

echo "=============================================================================="
echo " Training job completed successfully: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo " Model weights written to checkpoints/alaknanda_swe_surrogate.pt"
echo " Ready for TensorRT export via: python gpu_pipeline/deployment/export_tensorrt.py"
echo "=============================================================================="
