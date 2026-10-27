# Video Renderer Docker Deployment

## Prerequisites

1. **Docker** with GPU support
2. **NVIDIA Docker runtime** - Required for GPU rendering
   - Install: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

## Quick Start

### 1. Build the bundle first (required)
```bash
cd videoGen
bun run video:bundle
```

### 2. Build Docker image
```bash
docker build -t video-renderer -f Dockerfile.video-renderer videoGen
```

### 3. Run with docker-compose (recommended)
```bash
docker-compose -f docker-compose.video-renderer.yml up -d
```

### 4. Or run directly with GPU
```bash
docker run --gpus all -p 3031:3031 \
  -v ./mini-services/video-renderer/bundle:/app/bundle:ro \
  video-renderer
```

---

## Google Cloud Deployment (From GitHub)

### Option 1: Cloud Build (Automatic from GitHub)

1. **Enable Cloud Build:**
   ```bash
   gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

2. **Connect GitHub to Cloud Build:**
   - Go to Cloud Build in GCP Console
   - Click "Connect Repository"
   - Authorize GitHub and select your repo

3. **Create Trigger:**
   - Go to Triggers > Create Trigger
   - Event: Push to branch
   - Source: Your repo
   - Configuration: Cloud Build configuration file
   - Location: Repository

4. **The cloudbuild.yaml will:**
   - Build the video bundle
   - Build Docker image
   - Push to Container Registry

### Option 2: One-click Deployment Script

```bash
# Make script executable
chmod +x scripts/deploy-gcp.sh

# Run deployment (replace PROJECT_ID or it will use current project)
./scripts/deploy-gcp.sh your-gcp-project-id
```

This script will:
- Enable required APIs
- Create a GPU-enabled VM (T4)
- Upload bundle to Cloud Storage
- Deploy container automatically on VM startup

---

## GPU Cloud Providers

### RunPod (Recommended for GPU rendering)
1. Create account at https://runpod.io
2. Deploy GPU pod with:
   - Image: Custom (use Dockerfile)
   - GPU: RTX 4090 / A100 / H100
   - Container disk: 50GB

### Paperspace
- Use Gradient or Core machines
- Select GPU instance (A4000, A5000, etc.)

### AWS EC2 (GPU Instances)
- Instance types: g4dn, g5, p3, p4d
- Install NVIDIA Docker runtime

## Verify GPU is working

Check server logs:
```
[GPU] GPU Info: {
  hasGPU: true,
  gpuName: "NVIDIA GeForce RTX 4090",
  ...
}
[GPU] Attempting GPU acceleration with Vulkan
```

## Troubleshooting

### No GPU detected
```bash
# Test NVIDIA Docker
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

### Bundle not found
Make sure `./mini-services/video-renderer/bundle` directory exists with Remotion bundle before running:
```bash
ls -la mini-services/video-renderer/bundle/
```

### WebGL not working in Cloud Run
The service now uses Chrome for Testing with Vulkan. If WebGL still fails:
1. Check logs for Vulkan initialization errors
2. Falls back to software rendering (SwiftShader) if GPU not available
3. For Cloud Run GPU, ensure L4 GPU is properly attached
