// Clean rewrite of hardware-ui.DPleEu7M.js (canirun.ai).
//
// Pipeline:
//   1. Read what the browser is willing to disclose (WebGL renderer string,
//      WebGPU adapter info, navigator.deviceMemory, hardwareConcurrency).
//   2. Run cheap on-device benchmarks (CPU sqrt/sin loop, WebGPU compute,
//      WebGL texture sampling) to estimate cores and memory bandwidth.
//   3. Fall back to spec-sheet lookup tables when a vendor or OS hides info
//      (Apple GPUs are opaque, iOS lies about screen, etc).
//   4. Produce a normalized HardwareInfo object that other UI code can score.

// ────────────────────────────────────────────────────────────────────────────
// Spec tables (verbatim from upstream)
// ────────────────────────────────────────────────────────────────────────────

/** Desktop / workstation / datacenter discrete GPUs. */
const DESKTOP_GPUS = {
	"RTX 5090": { vram: 32, bw: 1792, cores: 21760 },
	"RTX 5080": { vram: 16, bw: 960, cores: 10752 },
	"RTX 5070 Ti": { vram: 16, bw: 896, cores: 8960 },
	"RTX 5070": { vram: 12, bw: 672, cores: 6144 },
	"RTX 5060 Ti 16GB": { vram: 16, bw: 448, cores: 4608 },
	"RTX 5060 Ti": { vram: 8, bw: 448, cores: 4608 },
	"RTX 5060": { vram: 8, bw: 448, cores: 3840 },
	"RTX 5050": { vram: 8, bw: 320, cores: 2560 },
	"RTX 4090": { vram: 24, bw: 1008, cores: 16384 },
	"RTX 4080 SUPER": { vram: 16, bw: 736, cores: 10240 },
	"RTX 4080": { vram: 16, bw: 717, cores: 9728 },
	"RTX 4070 Ti SUPER": { vram: 16, bw: 672, cores: 8448 },
	"RTX 4070 Ti": { vram: 12, bw: 504, cores: 7680 },
	"RTX 4070 SUPER": { vram: 12, bw: 504, cores: 7168 },
	"RTX 4070": { vram: 12, bw: 504, cores: 5888 },
	"RTX 4060 Ti 16GB": { vram: 16, bw: 288, cores: 4352 },
	"RTX 4060 Ti": { vram: 8, bw: 288, cores: 4352 },
	"RTX 4060": { vram: 8, bw: 272, cores: 3072 },
	"RTX 3090 Ti": { vram: 24, bw: 1008, cores: 10752 },
	"RTX 3090": { vram: 24, bw: 936, cores: 10496 },
	"RTX 3080 Ti": { vram: 12, bw: 912, cores: 10240 },
	"RTX 3080 12GB": { vram: 12, bw: 912, cores: 8960 },
	"RTX 3080": { vram: 10, bw: 760, cores: 8704 },
	"RTX 3070 Ti": { vram: 8, bw: 608, cores: 6144 },
	"RTX 3070": { vram: 8, bw: 448, cores: 5888 },
	"RTX 3060 Ti": { vram: 8, bw: 448, cores: 4864 },
	"RTX 3060": { vram: 12, bw: 360, cores: 3584 },
	"RTX 3050": { vram: 8, bw: 224, cores: 2560 },
	"RTX 5090 Laptop": { vram: 24, bw: 896, cores: 10496 },
	"RTX 5080 Laptop": { vram: 16, bw: 896, cores: 7680 },
	"RTX 5070 Ti Laptop": { vram: 12, bw: 672, cores: 5888 },
	"RTX 5070 Laptop": { vram: 8, bw: 384, cores: 4608 },
	"RTX 5060 Laptop": { vram: 8, bw: 384, cores: 3328 },
	"RTX 5050 Laptop": { vram: 8, bw: 384, cores: 2560 },
	"RTX 4090 Laptop": { vram: 16, bw: 576, cores: 9728 },
	"RTX 4080 Laptop": { vram: 12, bw: 432, cores: 7424 },
	"RTX 4070 Laptop": { vram: 8, bw: 256, cores: 4608 },
	"RTX 4060 Laptop": { vram: 8, bw: 256, cores: 3072 },
	"RTX 4050 Laptop": { vram: 6, bw: 192, cores: 2560 },
	"RTX 3080 Ti Laptop": { vram: 16, bw: 512, cores: 7424 },
	"RTX 3080 Laptop": { vram: 16, bw: 448, cores: 6144 },
	"RTX 3070 Ti Laptop": { vram: 8, bw: 448, cores: 5888 },
	"RTX 3070 Laptop": { vram: 8, bw: 448, cores: 5120 },
	"RTX 3060 Laptop": { vram: 6, bw: 336, cores: 3840 },
	"RTX 3050 Ti Laptop": { vram: 4, bw: 192, cores: 2560 },
	"RTX 3050 Laptop": { vram: 4, bw: 192, cores: 2048 },
	"RTX PRO 6000": { vram: 96, bw: 1792, cores: 24064 },
	"RTX 6000 Ada": { vram: 48, bw: 960, cores: 18176 },
	"RTX 5880 Ada": { vram: 48, bw: 960, cores: 14080 },
	"RTX 5000 Ada": { vram: 32, bw: 800, cores: 12800 },
	"RTX 4500 Ada": { vram: 24, bw: 432, cores: 7680 },
	"RTX 4000 SFF Ada": { vram: 20, bw: 320, cores: 6144 },
	"RTX 4000 Ada": { vram: 20, bw: 360, cores: 6144 },
	"RTX 3500 Ada": { vram: 12, bw: 432, cores: 5120 },
	"RTX 2000 Ada": { vram: 16, bw: 224, cores: 2816 },
	"RTX A6000": { vram: 48, bw: 768, cores: 10752 },
	"RTX A5500": { vram: 24, bw: 768, cores: 10240 },
	"RTX A5000": { vram: 24, bw: 768, cores: 8192 },
	"RTX A4500": { vram: 20, bw: 640, cores: 7168 },
	"RTX A4000": { vram: 16, bw: 448, cores: 6144 },
	"RTX A2000": { vram: 6, bw: 288, cores: 3328 },
	"RTX 2080 Ti": { vram: 11, bw: 616, cores: 4352 },
	"RTX 2080 SUPER": { vram: 8, bw: 496, cores: 3072 },
	"RTX 2080": { vram: 8, bw: 448, cores: 2944 },
	"RTX 2070 SUPER": { vram: 8, bw: 448, cores: 2560 },
	"RTX 2070": { vram: 8, bw: 448, cores: 2304 },
	"RTX 2060 SUPER": { vram: 8, bw: 448, cores: 2176 },
	"RTX 2060": { vram: 6, bw: 336, cores: 1920 },
	"RTX 2060 12GB": { vram: 12, bw: 336, cores: 2176 },
	"RTX 3050 6GB": { vram: 6, bw: 168, cores: 2304 },
	A100: { vram: 80, bw: 2039, cores: 6912 },
	H100: { vram: 80, bw: 3350, cores: 14592 },
	GH200: { vram: 96, bw: 4e3, cores: 16896 },
	"DGX Spark": { vram: 128, bw: 273, cores: 6144 },
	L40S: { vram: 48, bw: 864, cores: 18176 },
	L4: { vram: 24, bw: 300, cores: 7424 },
	T4: { vram: 16, bw: 300, cores: 2560 },
	"Tesla P40": { vram: 24, bw: 346, cores: 3840 },
	"RX 7900 XTX": { vram: 24, bw: 960, cores: 6144 },
	"RX 7900 XT": { vram: 20, bw: 800, cores: 5376 },
	"RX 7800 XT": { vram: 16, bw: 624, cores: 3840 },
	"RX 7700 XT": { vram: 12, bw: 432, cores: 3456 },
	"RX 7600 XT": { vram: 16, bw: 288, cores: 2048 },
	"RX 7600": { vram: 8, bw: 288, cores: 2048 },
	"RX 6900 XT": { vram: 16, bw: 512, cores: 5120 },
	"RX 6800 XT": { vram: 16, bw: 512, cores: 4608 },
	"RX 6800": { vram: 16, bw: 512, cores: 3840 },
	"RX 6750 XT": { vram: 12, bw: 432, cores: 2560 },
	"RX 6700 XT": { vram: 12, bw: 384, cores: 2560 },
	"RX 6650 XT": { vram: 8, bw: 280, cores: 2048 },
	"RX 6600 XT": { vram: 8, bw: 256, cores: 2048 },
	"RX 6600": { vram: 8, bw: 224, cores: 1792 },
	"RX 6500 XT": { vram: 4, bw: 144, cores: 1024 },
	"Arc A770": { vram: 16, bw: 560, cores: 4096 },
	"Arc A750": { vram: 8, bw: 512, cores: 3584 },
	"Arc A580": { vram: 8, bw: 512, cores: 3072 },
	"Arc A380": { vram: 6, bw: 186, cores: 1024 },
	"GTX 1660 Ti": { vram: 6, bw: 288, cores: 1536 },
	"GTX 1660 SUPER": { vram: 6, bw: 336, cores: 1408 },
	"GTX 1660": { vram: 6, bw: 192, cores: 1408 },
	"GTX 1650 SUPER": { vram: 4, bw: 192, cores: 1280 },
	"GTX 1650 Ti": { vram: 4, bw: 192, cores: 1024 },
	"GTX 1650": { vram: 4, bw: 128, cores: 896 },
	"GTX 1630": { vram: 4, bw: 96, cores: 512 },
	"GTX 1080 Ti": { vram: 11, bw: 484, cores: 3584 },
	"GTX 1080": { vram: 8, bw: 320, cores: 2560 },
	"GTX 1070 Ti": { vram: 8, bw: 256, cores: 2432 },
	"GTX 1070": { vram: 8, bw: 256, cores: 1920 },
	"GTX 1060 6GB": { vram: 6, bw: 192, cores: 1280 },
	"GTX 1060 3GB": { vram: 3, bw: 192, cores: 1152 },
	"GTX 1060": { vram: 6, bw: 192, cores: 1280 },
	"GTX 1050 Ti": { vram: 4, bw: 112, cores: 768 },
	"GTX 1050": { vram: 2, bw: 112, cores: 640 },
	"GTX 980 Ti": { vram: 6, bw: 336, cores: 2816 },
	"GTX 980": { vram: 4, bw: 224, cores: 2048 },
	"GTX 970": { vram: 4, bw: 224, cores: 1664 },
	"GTX 960": { vram: 2, bw: 112, cores: 1024 },
	"GTX 950": { vram: 2, bw: 105, cores: 768 },
	"Quadro RTX 8000": { vram: 48, bw: 672, cores: 4608 },
	"Quadro RTX 6000": { vram: 24, bw: 672, cores: 4608 },
	"Quadro RTX 5000": { vram: 16, bw: 448, cores: 3072 },
	"Quadro RTX 4000": { vram: 8, bw: 416, cores: 2304 },
	"Quadro RTX 3000": { vram: 6, bw: 336, cores: 1920 },
	"Quadro T2000": { vram: 4, bw: 128, cores: 1024 },
	"Quadro T1000": { vram: 4, bw: 128, cores: 896 },
	T1200: { vram: 4, bw: 192, cores: 1024 },
	"NVIDIA T600": { vram: 4, bw: 192, cores: 896 },
	"NVIDIA T550": { vram: 4, bw: 112, cores: 1024 },
	"NVIDIA T500": { vram: 4, bw: 80, cores: 896 },
	"Quadro P5200": { vram: 16, bw: 230, cores: 2560 },
	"Quadro P5000": { vram: 16, bw: 288, cores: 2560 },
	"Quadro P4200": { vram: 8, bw: 224, cores: 1792 },
	"Quadro P4000": { vram: 8, bw: 192, cores: 1792 },
	"Quadro P3000": { vram: 6, bw: 168, cores: 1280 },
	"Quadro P3200": { vram: 6, bw: 192, cores: 1792 },
	"Quadro P2000": { vram: 5, bw: 140, cores: 1024 },
	"Quadro P1000": { vram: 4, bw: 82, cores: 640 },
	"Quadro P620": { vram: 4, bw: 96, cores: 512 },
	"Quadro P600": { vram: 2, bw: 64, cores: 384 },
	"Quadro P520": { vram: 2, bw: 48, cores: 384 },
	"Quadro P500": { vram: 2, bw: 64, cores: 256 },
	"Quadro M5500": { vram: 8, bw: 211, cores: 2048 },
	"Quadro M5000M": { vram: 8, bw: 160, cores: 1536 },
	"Quadro M4000M": { vram: 4, bw: 160, cores: 1024 },
	"Quadro M3000M": { vram: 4, bw: 160, cores: 1024 },
	"Quadro M2200": { vram: 4, bw: 140, cores: 1024 },
	"Quadro M2000M": { vram: 4, bw: 80, cores: 640 },
	"Quadro M1200": { vram: 4, bw: 128, cores: 640 },
	"Quadro M1000M": { vram: 2, bw: 80, cores: 512 },
	"Quadro M620": { vram: 2, bw: 80, cores: 512 },
	"Quadro M600M": { vram: 2, bw: 64, cores: 384 },
	"Quadro M520": { vram: 1, bw: 40, cores: 384 },
	"Quadro M500M": { vram: 2, bw: 16, cores: 384 },
	"Quadro K5100M": { vram: 8, bw: 160, cores: 1536 },
	"Quadro K5000M": { vram: 4, bw: 173, cores: 1344 },
	"Quadro K4100M": { vram: 4, bw: 115, cores: 1152 },
	"Quadro K4000M": { vram: 4, bw: 134, cores: 960 },
	"Quadro K3100M": { vram: 4, bw: 80, cores: 768 },
	"Quadro K3000M": { vram: 2, bw: 80, cores: 576 },
	"Quadro K2100M": { vram: 2, bw: 48, cores: 576 },
	"Quadro K2000M": { vram: 2, bw: 64, cores: 384 },
	"Quadro K1100M": { vram: 2, bw: 64, cores: 384 },
	"Quadro K1000M": { vram: 2, bw: 64, cores: 384 },
	"Quadro K620M": { vram: 2, bw: 16, cores: 384 },
	"Quadro K610M": { vram: 1, bw: 29, cores: 192 },
	"Quadro K510M": { vram: 1, bw: 19.2, cores: 192 },
	"Quadro K500M": { vram: 2, bw: 28.8, cores: 192 },
	"RTX A3000": { vram: 6, bw: 192, cores: 4096 },
	"RTX A3000 12GB": { vram: 12, bw: 336, cores: 4096 },
	"RTX A2000 8GB": { vram: 8, bw: 224, cores: 2560 },
	"RTX A1000": { vram: 4, bw: 224, cores: 2048 },
	"RTX A500": { vram: 4, bw: 112, cores: 2048 },
	"RX 5700 XT": { vram: 8, bw: 448, cores: 2560 },
	"RX 5700": { vram: 8, bw: 448, cores: 2304 },
	"RX 5600 XT": { vram: 6, bw: 288, cores: 2304 },
	"RX 5500 XT": { vram: 8, bw: 224, cores: 1408 },
	"RX 590": { vram: 8, bw: 256, cores: 2304 },
	"RX 580": { vram: 8, bw: 256, cores: 2304 },
	"RX 570": { vram: 4, bw: 224, cores: 2048 },
	"RX 560": { vram: 4, bw: 112, cores: 1024 },
	"Radeon VII": { vram: 16, bw: 1024, cores: 3840 },
	"Vega 64": { vram: 8, bw: 484, cores: 4096 },
	"Vega 56": { vram: 8, bw: 410, cores: 3584 },
	"RX 9070 XT": { vram: 16, bw: 640, cores: 4096 },
	"RX 9070": { vram: 16, bw: 640, cores: 3584 },
	"RX 7900M": { vram: 16, bw: 720, cores: 4608 },
	"RX 7700S": { vram: 8, bw: 288, cores: 2048 },
	"RX 7600M XT": { vram: 8, bw: 288, cores: 2048 },
	"RX 7600M": { vram: 8, bw: 288, cores: 1792 },
	"RX 7600S": { vram: 8, bw: 288, cores: 1792 },
	"RX 6800M": { vram: 12, bw: 384, cores: 2560 },
	"RX 6700M": { vram: 10, bw: 320, cores: 2304 },
	"RX 6600M": { vram: 8, bw: 224, cores: 1792 },
	"RX 6500M": { vram: 4, bw: 144, cores: 1024 },
	"Ryzen AI MAX+ 395": { vram: 96, bw: 256, cores: 2560 },
	"Radeon 890M": { vram: 0, bw: 89, cores: 1024 },
	"Radeon 880M": { vram: 0, bw: 89, cores: 768 },
	"Radeon 780M": { vram: 0, bw: 89, cores: 768 },
	"Radeon 760M": { vram: 0, bw: 89, cores: 512 },
	"Radeon 680M": { vram: 0, bw: 77, cores: 768 },
	"Radeon 660M": { vram: 0, bw: 77, cores: 384 },
	"Vega 8": { vram: 0, bw: 51, cores: 512 },
	"Vega 7": { vram: 0, bw: 51, cores: 448 },
	"Arc A770M": { vram: 16, bw: 512, cores: 4096 },
	"Arc A550M": { vram: 8, bw: 224, cores: 2048 },
	"Arc A370M": { vram: 4, bw: 112, cores: 1024 },
	"Iris Xe": { vram: 0, bw: 68, cores: 96 },
	"Iris Plus": { vram: 0, bw: 50, cores: 64 },
	"UHD 770": { vram: 0, bw: 76, cores: 32 },
	"UHD 730": { vram: 0, bw: 76, cores: 24 },
	"UHD Graphics 630": { vram: 0, bw: 42, cores: 24 },
	"UHD Graphics 620": { vram: 0, bw: 34, cores: 24 },
};

/** Apple Silicon chips (M1–M5 + Pro/Max/Ultra variants). Keys are lowercase
 *  because we match against the WebGPU adapter device string verbatim. */
const APPLE_SILICON = {
	"m5 max": { ram: 36, bw: 614, cpuCores: 18, gpuCores: 40 },
	"m5 pro": { ram: 24, bw: 307, cpuCores: 18, gpuCores: 20 },
	m5: { ram: 16, bw: 153, cpuCores: 10, gpuCores: 10 },
	"m4 max": { ram: 36, bw: 546, cpuCores: 16, gpuCores: 40 },
	"m4 pro": { ram: 24, bw: 273, cpuCores: 14, gpuCores: 20 },
	m4: { ram: 16, bw: 120, cpuCores: 10, gpuCores: 10 },
	"m3 ultra": { ram: 96, bw: 819, cpuCores: 32, gpuCores: 80 },
	"m3 max": { ram: 36, bw: 400, cpuCores: 16, gpuCores: 40 },
	"m3 pro": { ram: 18, bw: 150, cpuCores: 12, gpuCores: 18 },
	m3: { ram: 8, bw: 100, cpuCores: 8, gpuCores: 10 },
	"m2 ultra": { ram: 64, bw: 800, cpuCores: 24, gpuCores: 76 },
	"m2 max": { ram: 32, bw: 400, cpuCores: 12, gpuCores: 38 },
	"m2 pro": { ram: 16, bw: 200, cpuCores: 12, gpuCores: 19 },
	m2: { ram: 8, bw: 100, cpuCores: 8, gpuCores: 10 },
	"m1 ultra": { ram: 64, bw: 800, cpuCores: 20, gpuCores: 64 },
	"m1 max": { ram: 32, bw: 400, cpuCores: 10, gpuCores: 32 },
	"m1 pro": { ram: 16, bw: 200, cpuCores: 10, gpuCores: 16 },
	m1: { ram: 8, bw: 68, cpuCores: 8, gpuCores: 8 },
};

/** Mobile / phone GPUs. `ram` is set only for Pixel Tensor SoCs where the
 *  whole device's spec is well known. */
const MOBILE_GPUS = {
	"Adreno 830": { bw: 90 },
	"Adreno 750": { bw: 77 },
	"Adreno 740": { bw: 62 },
	"Adreno 735": { bw: 51 },
	"Adreno 730": { bw: 51 },
	"Adreno 725": { bw: 44 },
	"Adreno 720": { bw: 38 },
	"Adreno 710": { bw: 34 },
	"Adreno 660": { bw: 44 },
	"Adreno 650": { bw: 44 },
	"Adreno 642": { bw: 17 },
	"Adreno 640": { bw: 34 },
	"Adreno 630": { bw: 30 },
	"Adreno 620": { bw: 17 },
	"Adreno 619": { bw: 17 },
	"Adreno 618": { bw: 14 },
	"Adreno 616": { bw: 14 },
	"Adreno 612": { bw: 10 },
	"Immortalis-G925": { bw: 77 },
	"Immortalis-G720": { bw: 77 },
	"Immortalis-G715": { bw: 51 },
	"Mali-G925": { bw: 77 },
	"Mali-G720": { bw: 77 },
	"Mali-G715": { bw: 51 },
	"Mali-G710": { bw: 44 },
	"Mali-G78": { bw: 35 },
	"Mali-G77": { bw: 30 },
	"Mali-G76": { bw: 25 },
	"Mali-G72": { bw: 20 },
	"Mali-G71": { bw: 15 },
	"Mali-G57": { bw: 17 },
	"Mali-G52": { bw: 12 },
	"Xclipse 940": { bw: 51 },
	"Xclipse 930": { bw: 44 },
	"Xclipse 920": { bw: 38 },
	"Tensor G5": { bw: 56, ram: 16 },
	"Tensor G4": { bw: 51, ram: 12 },
	"Tensor G3": { bw: 51, ram: 8 },
	"Tensor G2": { bw: 44, ram: 8 },
	"Tensor G1": { bw: 35, ram: 8 },
};

/** Single-board computers. */
const SBCS = {
	"Raspberry Pi 5 (8 GB)": { ram: 8, bw: 32 },
	"Raspberry Pi 5 (4 GB)": { ram: 4, bw: 32 },
	"Raspberry Pi 4 (8 GB)": { ram: 8, bw: 13 },
	"Raspberry Pi 4 (4 GB)": { ram: 4, bw: 13 },
};

/** When the WebGPU compute benchmark gives us a raw FLOPS-ish number, divide
 *  by this vendor-specific factor to land in the "GPU cores" ballpark. The
 *  values come from calibrating against known hardware. */
const VENDOR_FLOPS_PER_CORE = {
	apple: 400,
	nvidia: 5,
	amd: 4.5,
	ati: 4.5,
	intel: 16,
	qualcomm: 3,
	arm: 8,
};

/** Expected CPU benchmark scores per Apple Silicon generation. Used to
 *  disambiguate M1 vs M2 vs M3 etc. when other signals are weak. */
const APPLE_CPU_BENCHMARK_BY_GEN = { 1: 67, 2: 82, 3: 95, 4: 107, 5: 120 };

/** Assumed DDR4/DDR5 system-RAM bandwidth in GB/s — used when a model has to
 *  spill out of VRAM into main memory. Conservative. */
const SYSTEM_RAM_BANDWIDTH_GB_S = 50;

/** localStorage key for user-supplied hardware overrides. */
const OVERRIDES_KEY = "canirun-hw-overrides";

// ────────────────────────────────────────────────────────────────────────────
// Tiny utilities
// ────────────────────────────────────────────────────────────────────────────

/** Linear interpolation across two (x,y) anchor points. */
function linearMap(x, x0, x1, y0, y1) {
	return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

/** "m4 pro" → "M4 Pro" */
function titleCase(s) {
	return s
		.split(" ")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/** Detect coarse OS from User-Agent. Returns null for unknown UAs. */
function detectOS() {
	const ua = navigator.userAgent;
	if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
	if (ua.includes("Mac OS X")) return "macOS";
	if (ua.includes("Windows")) return "Windows";
	if (ua.includes("Android")) return "Android";
	if (ua.includes("CrOS")) return "ChromeOS";
	if (ua.includes("Linux")) return "Linux";
	return null;
}

// ────────────────────────────────────────────────────────────────────────────
// CPU microbenchmark
// ────────────────────────────────────────────────────────────────────────────

/** Run 2M iterations of `sqrt+sin+cos` and return a relative score scaled so
 *  modern desktop chips land around ~80-120. Takes ~30ms on a decent CPU. */
function benchmarkCPU() {
	const start = performance.now();
	let acc = 0;
	for (let i = 0; i < 2_000_000; i++) {
		acc += Math.sqrt(i) * Math.sin(i) + Math.cos(i);
	}
	const elapsedMs = performance.now() - start;
	// The log() guards against the JIT optimizing away the unused result.
	if (acc === Infinity) console.log(acc);
	return Math.round((2_000_000 / elapsedMs) * 0.05);
}

// ────────────────────────────────────────────────────────────────────────────
// WebGL: renderer string + display normalization
// ────────────────────────────────────────────────────────────────────────────

/**
 * Read the unmasked GPU renderer and vendor strings via WebGL. Returns
 * `{renderer: null, vendor: null}` if WebGL or the debug extension is blocked
 * (some privacy-hardened browsers redact this).
 */
function readWebGLRendererInfo() {
	try {
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
		if (!gl) return { renderer: null, vendor: null };

		const debugExt = gl.getExtension("WEBGL_debug_renderer_info");
		if (debugExt) {
			return {
				renderer: gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL),
				vendor: gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL),
			};
		}
		return {
			renderer: gl.getParameter(gl.RENDERER),
			vendor: gl.getParameter(gl.VENDOR),
		};
	} catch {
		return { renderer: null, vendor: null };
	}
}

/**
 * Trim a raw WebGL renderer string down to something we'd want to show in
 * the UI. Strips ANGLE wrappers, vendor doubling, driver-version detritus
 * and the redundant memory-size suffix.
 */
function prettifyRendererString(raw) {
	let s = raw
		.replace(/^ANGLE\s*\(\s*/, "")
		.replace(/\)\s*$/, "")
		.replace(/,\s*ANGLE Metal Renderer:\s*/, " — ")
		.replace(/,\s*Unspecified Version\s*/i, "")
		.replace(/,\s*Direct3D.*$/i, "")
		.replace(/,\s*OpenGL.*$/i, "")
		.replace(/,\s*Vulkan.*$/i, "")
		.replace(/\s+Direct3D\d*/i, "")
		.replace(/vs_\d+_\d+.*$/, "")
		.replace(/\(0x[0-9A-Fa-f]+\)/g, "")
		.replace(/\s*\(\d+\s*GB\)/gi, "")
		.replace(/\s+\d+\s*GB\b/gi, "")
		.replace(/^(NVIDIA|AMD|Intel),\s*\1\b/i, "$1")
		.replace(/\s{2,}/g, " ")
		.trim();

	// For Apple, keep only what comes after "Apple —" / "Apple ".
	const appleMatch = s.match(/Apple\s*(?:—\s*)?(.+)/i);
	if (appleMatch && appleMatch[1].trim()) s = appleMatch[1].trim();
	return s;
}

// ────────────────────────────────────────────────────────────────────────────
// Renderer string → spec-table lookups
// ────────────────────────────────────────────────────────────────────────────

/** Look up a desktop GPU by substring match. Picks the longest matching key
 *  so "RTX 4070 Ti SUPER" wins over "RTX 4070". */
function matchDesktopGPU(rendererString) {
	const haystack = rendererString
		.toUpperCase()
		.replace(/\(TM\)/g, "")
		.replace(/\s+/g, " ")
		.trim();

	let best = null;
	let bestLen = 0;
	for (const [name, spec] of Object.entries(DESKTOP_GPUS)) {
		if (haystack.includes(name.toUpperCase()) && name.length > bestLen) {
			best = spec;
			bestLen = name.length;
		}
	}
	return best;
}

/** Look up an Adreno/Mali/Xclipse/Tensor mobile GPU by substring match. */
function matchMobileGPU(rendererString) {
	const haystack = rendererString
		.toUpperCase()
		.replace(/\(TM\)/gi, "")
		.replace(/\s+/g, " ")
		.trim();
	for (const [name, spec] of Object.entries(MOBILE_GPUS)) {
		if (haystack.includes(name.toUpperCase())) return { name, bw: spec.bw };
	}
	return null;
}

/** Look up an Apple Silicon chip in the renderer string (e.g. "Apple M3 Pro").
 *  Falls back to M1 specs if we see "apple" but no specific chip name. */
function matchAppleSilicon(rendererString) {
	const haystack = rendererString.toLowerCase();
	for (const [chip, spec] of Object.entries(APPLE_SILICON)) {
		if (haystack.includes(chip)) return spec;
	}
	return haystack.includes("apple") ? APPLE_SILICON.m1 : null;
}

/** Detect any Apple GPU (the renderer often just says "Apple GPU"). */
function isAppleGPURenderer(rendererString) {
	const s = rendererString.toLowerCase();
	return (
		s.includes("apple") &&
		(s.includes("m1") ||
			s.includes("m2") ||
			s.includes("m3") ||
			s.includes("m4") ||
			s.includes("m5") ||
			s.includes("gpu"))
	);
}

/** Parse a "(16 GB)" or "16 GB" memory hint out of the renderer string. */
function parseVRAMFromRenderer(rendererString) {
	const m =
		rendererString.match(/\((\d+)\s*GB\)/i) ||
		rendererString.match(/\b(\d+)\s*GB\b/i);
	if (!m) return null;
	const gb = parseInt(m[1], 10);
	return gb >= 1 && gb <= 128 ? gb : null;
}

// ────────────────────────────────────────────────────────────────────────────
// iOS fingerprinting (browser hides the device, so we infer from screen+CPU)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Best-effort iPhone/iPad identification from screen geometry + CPU benchmark.
 * iOS Safari refuses to expose deviceMemory or hardware specifics, so we
 * triangulate: screen size separates iPad/iPhone form factors, two known
 * resolutions tell us "Pro Max" vs "Pro", and the CPU score buckets the chip
 * generation.
 */
function fingerprintIOSDevice(cpuBenchmark) {
	const shortSide = Math.min(screen.width, screen.height);
	const longSide = Math.max(screen.width, screen.height);
	const screenKey = `${shortSide}x${longSide}x${window.devicePixelRatio}`;

	// iPad path (any iOS device with a "tablet-sized" short edge).
	if (shortSide >= 744) {
		if (cpuBenchmark > 100)
			return {
				name: "iPad Pro (M-series)",
				ram: 16,
				bw: 100,
				cpuCores: 10,
				gpuCores: 10,
				isTablet: true,
			};
		if (cpuBenchmark > 80)
			return {
				name: "iPad Air",
				ram: 8,
				bw: 68,
				cpuCores: 8,
				gpuCores: 10,
				isTablet: true,
			};
		return {
			name: "iPad",
			ram: 4,
			bw: 42,
			cpuCores: 6,
			gpuCores: 4,
			isTablet: true,
		};
	}

	// iPhone path. These two screen keys are uniquely Pro Max / Pro.
	const proMaxKeys = ["440x956x3"];
	const proKeys = ["402x874x3"];
	const isPro = proKeys.includes(screenKey) || proMaxKeys.includes(screenKey);
	const proSuffix = proMaxKeys.includes(screenKey)
		? " Pro Max"
		: proKeys.includes(screenKey)
			? " Pro"
			: "";

	if (cpuBenchmark > 115)
		return {
			name: `iPhone${proSuffix} (A19 Pro)`,
			ram: 8,
			bw: 77,
			cpuCores: 6,
			gpuCores: 6,
			isTablet: false,
		};
	if (cpuBenchmark > 105)
		return {
			name: `iPhone${proSuffix} (A18 Pro)`,
			ram: 8,
			bw: 68,
			cpuCores: 6,
			gpuCores: 6,
			isTablet: false,
		};
	if (cpuBenchmark > 97)
		return {
			name: `iPhone${proSuffix} (A18)`,
			ram: 8,
			bw: 60,
			cpuCores: 6,
			gpuCores: 5,
			isTablet: false,
		};
	if (cpuBenchmark > 90)
		return {
			name: `iPhone${proSuffix} (A17 Pro)`,
			ram: 8,
			bw: 68,
			cpuCores: 6,
			gpuCores: 6,
			isTablet: false,
		};
	if (cpuBenchmark > 75)
		return {
			name: "iPhone (A16)",
			ram: isPro ? 8 : 6,
			bw: 51,
			cpuCores: 6,
			gpuCores: 5,
			isTablet: false,
		};
	if (cpuBenchmark > 60)
		return {
			name: "iPhone (A15)",
			ram: 6,
			bw: 51,
			cpuCores: 6,
			gpuCores: 5,
			isTablet: false,
		};
	if (cpuBenchmark > 45)
		return {
			name: "iPhone (A14)",
			ram: 4,
			bw: 42,
			cpuCores: 6,
			gpuCores: 4,
			isTablet: false,
		};
	return {
		name: "iPhone (A13 or older)",
		ram: 4,
		bw: 34,
		cpuCores: 6,
		gpuCores: 4,
		isTablet: false,
	};
}

// ────────────────────────────────────────────────────────────────────────────
// WebGPU adapter, plus on-device benchmarks
// ────────────────────────────────────────────────────────────────────────────

/** Request a WebGPU adapter and read its `device` and `architecture` info. */
async function readWebGPUAdapterInfo() {
	try {
		if (!("gpu" in navigator))
			return { supported: false, device: null, arch: null, adapter: null };

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter)
			return { supported: false, device: null, arch: null, adapter: null };

		let device = null,
			arch = null;
		if (adapter.info) {
			device = adapter.info.device || adapter.info.description || null;
			arch = adapter.info.architecture || null;
		} else if (typeof adapter.requestAdapterInfo === "function") {
			// Older browsers needed an explicit call.
			try {
				const info = await adapter.requestAdapterInfo();
				device = info.device || info.description || null;
				arch = info.architecture || null;
			} catch {
				/* ignore */
			}
		}
		return { supported: true, device, arch, adapter };
	} catch {
		return { supported: false, device: null, arch: null, adapter: null };
	}
}

/**
 * Run a 512K-element compute pass that does 512 fused-multiply-add ops per
 * thread, time it, and divide by a vendor-specific factor to get a "GPU
 * cores" estimate. Returns null on any failure.
 */
async function benchmarkGPUCores(adapter, vendor) {
	try {
		const device = await adapter.requestDevice();
		const N = 512 * 1024;
		const ITERS = 512;
		const module = device.createShaderModule({
			code: `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) id: vec3u) {
        let idx = id.x;
        if (idx >= ${N}u) { return; }
        var x: f32 = f32(idx) * 0.001;
        for (var i: u32 = 0; i < ${ITERS}u; i++) {
          x = x * 1.0001 + 0.0001;
        }
        data[idx] = x;
      }
    `,
		});
		const buffer = device.createBuffer({
			size: N * 4,
			usage: GPUBufferUsage.STORAGE,
		});
		const pipeline = device.createComputePipeline({
			layout: "auto",
			compute: { module, entryPoint: "main" },
		});
		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer } }],
		});

		const dispatch = () => {
			const encoder = device.createCommandEncoder();
			const pass = encoder.beginComputePass();
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.dispatchWorkgroups(Math.ceil(N / 256));
			pass.end();
			device.queue.submit([encoder.finish()]);
			return device.queue.onSubmittedWorkDone();
		};

		await dispatch(); // warmup
		const t0 = performance.now();
		await dispatch();
		const elapsedMs = performance.now() - t0;

		buffer.destroy();
		device.destroy();

		const opsPerMs = (N * ITERS * 2) / elapsedMs / 1e6; // "MFLOPS-ish"
		const vendorLower = (vendor || "").toLowerCase();
		for (const [key, divisor] of Object.entries(VENDOR_FLOPS_PER_CORE)) {
			if (vendorLower.includes(key)) return Math.round(opsPerMs / divisor);
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Measure GPU memory bandwidth by repeatedly copying a 64MB storage buffer.
 * The 0.6 efficiency factor brings observed throughput closer to
 * theoretical-peak GB/s as reported in spec sheets.
 */
async function benchmarkGPUBandwidth(adapter) {
	try {
		const device = await adapter.requestDevice();
		const N_VEC4 = 4 * 1024 * 1024; // 4M vec4f32 elements
		const BYTES = N_VEC4 * 16; // 64 MiB

		const module = device.createShaderModule({
			code: `
      @group(0) @binding(0) var<storage, read>       src: array<vec4<f32>>;
      @group(0) @binding(1) var<storage, read_write> dst: array<vec4<f32>>;
      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) id: vec3u) {
        if (id.x < ${N_VEC4}u) { dst[id.x] = src[id.x]; }
      }
    `,
		});

		const src = device.createBuffer({
			size: BYTES,
			usage: GPUBufferUsage.STORAGE,
		});
		const dst = device.createBuffer({
			size: BYTES,
			usage: GPUBufferUsage.STORAGE,
		});
		const pipeline = device.createComputePipeline({
			layout: "auto",
			compute: { module, entryPoint: "main" },
		});
		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: src } },
				{ binding: 1, resource: { buffer: dst } },
			],
		});

		const dispatch = () => {
			const encoder = device.createCommandEncoder();
			const pass = encoder.beginComputePass();
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.dispatchWorkgroups(Math.ceil(N_VEC4 / 256));
			pass.end();
			device.queue.submit([encoder.finish()]);
		};

		dispatch();
		await device.queue.onSubmittedWorkDone(); // warmup

		const REPS = 10;
		const t0 = performance.now();
		for (let i = 0; i < REPS; i++) dispatch();
		await device.queue.onSubmittedWorkDone();
		const elapsedMs = performance.now() - t0;

		src.destroy();
		dst.destroy();
		device.destroy();

		// BYTES * 2 because each copy reads + writes the buffer.
		const measuredGBs = (BYTES * 2 * REPS) / elapsedMs / 1e6;
		return Math.round(measuredGBs / 0.6);
	} catch {
		return null;
	}
}

/**
 * WebGL fallback bandwidth benchmark: render a 2048×2048 framebuffer where
 * each fragment samples a texture 32 times. Returns null on shader/link
 * failure or implausible results (<15 or >4000 GB/s).
 */
function benchmarkWebGLBandwidth() {
	try {
		const canvas = document.createElement("canvas");
		const SIZE = 2048;
		canvas.width = SIZE;
		canvas.height = SIZE;
		const gl = canvas.getContext("webgl2");
		if (!gl) return null;

		const TAPS = 32;
		const vertSrc = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
        v_uv = a_pos * 0.5 + 0.5;
      }`;
		const fragSrc = `#version 300 es
      precision highp float;
      uniform sampler2D u_tex;
      in vec2 v_uv;
      out vec4 o;
      void main() {
        vec4 s = vec4(0.0);
        float step = 1.0 / ${SIZE}.0;
        for (int i = 0; i < ${TAPS}; i++) {
          s += texture(u_tex, fract(v_uv + vec2(float(i) * step, float(i) * step * 0.73)));
        }
        o = s * ${(1 / TAPS).toFixed(6)};
      }`;

		const compile = (type, src) => {
			const sh = gl.createShader(type);
			gl.shaderSource(sh, src);
			gl.compileShader(sh);
			return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
		};

		const vs = compile(gl.VERTEX_SHADER, vertSrc);
		const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
		if (!vs || !fs) return null;

		const program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

		// Fullscreen triangle strip.
		const vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const posLoc = gl.getAttribLocation(program, "a_pos");
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

		// Source texture filled with a deterministic noise pattern.
		const srcTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, srcTex);
		const pixels = new Uint8Array(SIZE * SIZE * 4);
		for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7 + 13) & 255;
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA8,
			SIZE,
			SIZE,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixels,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

		// Render target — we don't care about the pixels, just the work.
		const dstTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, dstTex);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA8,
			SIZE,
			SIZE,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			dstTex,
			0,
		);

		gl.useProgram(program);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, srcTex);
		gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);
		gl.viewport(0, 0, SIZE, SIZE);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.finish(); // warmup

		const REPS = 10;
		const t0 = performance.now();
		for (let i = 0; i < REPS; i++) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.finish();
		const elapsedMs = performance.now() - t0;

		gl.deleteTexture(srcTex);
		gl.deleteTexture(dstTex);
		gl.deleteFramebuffer(fbo);
		gl.deleteProgram(program);
		gl.deleteShader(vs);
		gl.deleteShader(fs);
		gl.deleteBuffer(vbo);

		const bytesRead = SIZE * SIZE * TAPS * 4 * REPS;
		const bytesWritten = SIZE * SIZE * 4 * REPS;
		const measuredGBs = (bytesRead + bytesWritten) / elapsedMs / 1e6;
		const result = Math.round(measuredGBs / 0.35);
		return result < 15 || result > 4000 ? null : result;
	} catch {
		return null;
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Heuristic / last-resort bandwidth estimate
// ────────────────────────────────────────────────────────────────────────────

/**
 * When neither benchmark works and we couldn't match a spec-table entry,
 * guess bandwidth from the GPU family and a VRAM hint. Returns null if we
 * can't even tell if it's a "real" GPU.
 */
function estimateBandwidthByHeuristic(renderer, vendor, vramGB, os) {
	if (!renderer && !vendor) return null;

	const r = (renderer || "").toUpperCase();
	const v = (vendor || "").toUpperCase();
	const isNvidia =
		v.includes("NVIDIA") || r.includes("NVIDIA") || r.includes("GEFORCE");
	const isAMD = v.includes("AMD") || v.includes("ATI") || r.includes("RADEON");
	const isIntel = v.includes("INTEL") || r.includes("INTEL");
	const isIntelIGP =
		isIntel &&
		(r.includes("UHD") || r.includes("IRIS") || r.includes("HD GRAPHICS"));

	if (isIntelIGP) return 50;

	if (isNvidia) {
		if (r.includes("RTX")) {
			if (vramGB && vramGB >= 20) return 700;
			if (vramGB && vramGB >= 12) return 450;
			if (vramGB && vramGB >= 8) return 300;
			return 250;
		}
		if (r.includes("GTX")) {
			if (vramGB && vramGB >= 8) return 250;
			if (vramGB && vramGB >= 4) return 150;
			return 112;
		}
		return vramGB && vramGB >= 8 ? 300 : 150;
	}

	if (isAMD) {
		if (r.includes("RADEON GRAPHICS") || r.includes("RADEON(TM) GRAPHICS"))
			return 55;
		if (vramGB && vramGB >= 16) return 500;
		if (vramGB && vramGB >= 8) return 300;
		if (vramGB && vramGB >= 4) return 180;
		return 150;
	}

	// Unknown desktop GPU on Windows/Linux — assume something modest.
	if (os === "Windows" || os === "Linux") return 60;
	return null;
}

/**
 * Estimate VRAM from `adapter.limits.maxBufferSize`. We assume a typical
 * adapter exposes ~half of physical VRAM as max-buffer, then snap to the
 * nearest plausible factory configuration. Returns null if the value looks
 * unreliable.
 */
function estimateVRAMFromAdapterLimits(adapter) {
	try {
		const maxBufferSize = adapter.limits?.maxBufferSize;
		if (!maxBufferSize) return null;

		const maxBufferGB = maxBufferSize / 1024 ** 3;
		if (maxBufferGB < 0.5) return null;

		const guessGB = maxBufferGB * 2;
		const KNOWN_CONFIGS = [
			2, 3, 4, 6, 8, 10, 11, 12, 16, 20, 24, 32, 48, 64, 80, 128, 192,
		];
		let nearest = KNOWN_CONFIGS[0];
		for (const c of KNOWN_CONFIGS) {
			if (Math.abs(c - guessGB) < Math.abs(nearest - guessGB)) nearest = c;
		}
		return nearest >= 2 ? nearest : null;
	} catch {
		return null;
	}
}

/**
 * Pick the most likely Apple Silicon chip when the renderer string just says
 * "Apple GPU". Scores each candidate against measured bandwidth, RAM, GPU
 * core count, CPU cores, and the per-generation CPU benchmark expectation.
 * Returns null if no chip scores above a low threshold.
 */
function identifyAppleChipByMeasurements({
	measuredBW,
	estimatedRAM,
	estimatedGPUCores,
	cpuBenchmark,
	cpuCores,
}) {
	// If we have RAM or GPU-core hints, bandwidth is a much stronger signal.
	const hasMemoryHints = estimatedRAM !== null || estimatedGPUCores !== null;
	let bestChip = null;
	let bestScore = -1;

	for (const [chip, spec] of Object.entries(APPLE_SILICON)) {
		let score = 0;

		if (measuredBW !== null) {
			const ratio = measuredBW / spec.bw;
			score += (hasMemoryHints ? 35 : 3) * Math.max(0, 1 - Math.abs(1 - ratio));
		}
		if (estimatedRAM !== null) {
			const ratio = estimatedRAM / spec.ram;
			score += 25 * Math.max(0, 1 - Math.abs(1 - ratio));
		}
		if (estimatedGPUCores !== null) {
			const ratio = estimatedGPUCores / spec.gpuCores;
			score += 20 * Math.max(0, 1 - Math.abs(1 - ratio));
		}
		if (cpuCores > 0) {
			const diff = Math.abs(cpuCores - spec.cpuCores);
			score += 20 * Math.max(0, 1 - diff / 8);
		}

		const gen = parseInt(chip.match(/m(\d)/)?.[1] || "0");
		if (gen > 0 && cpuBenchmark > 0) {
			const expected = APPLE_CPU_BENCHMARK_BY_GEN[gen] ?? 67;
			const diff = Math.abs(cpuBenchmark - expected);
			score += Math.max(0, 10 - diff * 0.4);
		}

		if (score > bestScore) {
			bestScore = score;
			bestChip = chip;
		}
	}

	return bestScore > 5 ? bestChip : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detect the host's hardware and return a HardwareInfo object suitable for
 * the scoring pipeline. Single async call; safe to invoke once on page load.
 *
 * @returns {Promise<{
 *   gpuRenderer: string|null, gpuVendor: string|null,
 *   gpuCores: number|null, ramGB: number|null,
 *   estimatedVRAM: number|null, memoryBandwidth: number|null,
 *   systemRAM: number|null, deviceMemoryRaw: number|null,
 *   webgpu: boolean, webgpuDevice: string|null, webgpuArch: string|null,
 *   isAppleSilicon: boolean, totalUsableRAM: number|null,
 *   platform: string|null, cpuBenchmark: number,
 *   isMobile: boolean, deviceName: string|null,
 * }>}
 */
async function detectHardware() {
	const deviceMemoryRaw = navigator.deviceMemory || null;
	const { renderer, vendor } = readWebGLRendererInfo();
	const platform = detectOS();
	const cpuBenchmark = benchmarkCPU();
	const wgpu = await readWebGPUAdapterInfo();

	let isAppleSilicon = renderer ? isAppleGPURenderer(renderer) : false;
	const desktopMatch = renderer ? matchDesktopGPU(renderer) : null;
	let appleMatch = renderer ? matchAppleSilicon(renderer) : null;
	const vramFromName = renderer ? parseVRAMFromRenderer(renderer) : null;
	const isMobile = platform === "iOS" || platform === "Android";

	// If the renderer doesn't name a chip (e.g. just "Apple GPU"), but the OS
	// is macOS and the vendor or renderer says Apple, treat as Apple Silicon
	// and use the post-benchmark identification path.
	const rendererHasExplicitChip = renderer
		? /\bm[1-9]\b/i.test(renderer)
		: false;
	const macOSGenericApple =
		platform === "macOS" &&
		!rendererHasExplicitChip &&
		(isAppleSilicon || vendor?.toLowerCase().includes("apple") === true);
	if (macOSGenericApple) isAppleSilicon = true;

	let ramGB = null,
		estimatedVRAM = null,
		memoryBandwidth = null;
	let deviceName = null,
		gpuCores = null;

	if (platform === "iOS") {
		const dev = fingerprintIOSDevice(cpuBenchmark);
		deviceName = dev.name;
		ramGB = dev.ram;
		memoryBandwidth = dev.bw;
		gpuCores = dev.gpuCores;
		// Treat large iPads as "Apple Silicon" for scoring purposes.
		isAppleSilicon = dev.isTablet && cpuBenchmark > 100;
	} else if (platform === "Android") {
		const mobile = renderer ? matchMobileGPU(renderer) : null;
		if (mobile) {
			memoryBandwidth = mobile.bw;
			deviceName = mobile.name;
		}
		ramGB = deviceMemoryRaw;
		isAppleSilicon = false;
	} else if (isAppleSilicon && appleMatch && !macOSGenericApple) {
		ramGB = appleMatch.ram;
		memoryBandwidth = appleMatch.bw;
		gpuCores = appleMatch.gpuCores;
	} else if (desktopMatch) {
		estimatedVRAM = vramFromName ?? desktopMatch.vram;
		memoryBandwidth = desktopMatch.bw;
		gpuCores = desktopMatch.cores;
		ramGB = estimatedVRAM;
	} else {
		ramGB = deviceMemoryRaw;
		if (vramFromName) {
			estimatedVRAM = vramFromName;
			ramGB = vramFromName;
		}
	}

	// Fill in gaps using live benchmarks where possible.
	if (!gpuCores && wgpu.adapter) {
		gpuCores = await benchmarkGPUCores(wgpu.adapter, vendor);
	}
	if (!estimatedVRAM && !isAppleSilicon && !isMobile && wgpu.adapter) {
		const limitsGuess = estimateVRAMFromAdapterLimits(wgpu.adapter);
		if (limitsGuess) {
			estimatedVRAM = limitsGuess;
			ramGB = limitsGuess;
		}
	}
	if (!memoryBandwidth && wgpu.adapter) {
		memoryBandwidth = await benchmarkGPUBandwidth(wgpu.adapter);
	}
	if (!memoryBandwidth) memoryBandwidth = benchmarkWebGLBandwidth();
	if (!memoryBandwidth) {
		memoryBandwidth = estimateBandwidthByHeuristic(
			renderer,
			vendor,
			estimatedVRAM ?? vramFromName,
			platform,
		);
	}

	// For generic-Apple macOS, score-identify the chip now that we have data.
	if (macOSGenericApple) {
		const ramHint = wgpu.adapter
			? estimateVRAMFromAdapterLimits(wgpu.adapter)
			: null;
		const chip = identifyAppleChipByMeasurements({
			measuredBW: memoryBandwidth,
			estimatedRAM: ramHint,
			estimatedGPUCores: gpuCores,
			cpuBenchmark,
			cpuCores: navigator.hardwareConcurrency || 0,
		});
		if (chip && APPLE_SILICON[chip]) {
			const spec = APPLE_SILICON[chip];
			ramGB = spec.ram;
			memoryBandwidth = spec.bw;
			gpuCores = spec.gpuCores;
			deviceName = "Apple " + titleCase(chip);
		}
	}

	// Coarse system-RAM bucket: phones/Apple Silicon are unified, so leave null.
	let systemRAM;
	if (isAppleSilicon || isMobile) systemRAM = null;
	else if (deviceMemoryRaw != null) systemRAM = deviceMemoryRaw >= 8 ? 16 : 4;
	else systemRAM = 16;

	return {
		gpuRenderer: renderer,
		gpuVendor: vendor,
		gpuCores,
		ramGB,
		estimatedVRAM,
		memoryBandwidth,
		systemRAM,
		deviceMemoryRaw,
		webgpu: wgpu.supported,
		webgpuDevice: wgpu.device,
		webgpuArch: wgpu.arch,
		isAppleSilicon,
		totalUsableRAM: ramGB,
		platform,
		cpuBenchmark,
		isMobile,
		deviceName,
	};
}

/** Human-friendly device label for the UI. */
function describeDevice(hw) {
	if (hw.deviceName) return hw.deviceName;
	if (hw.gpuRenderer) return prettifyRendererString(hw.gpuRenderer);
	return "Unknown";
}

// ────────────────────────────────────────────────────────────────────────────
// Model-fit scoring
// ────────────────────────────────────────────────────────────────────────────

/**
 * Can this hardware run a model of `modelSizeGB`? Returns one of
 * "can-run" | "can-run-slow" | "tight" | "cannot-run" | "unknown".
 *
 * Mobile and Apple Silicon have unified memory so we compare against a
 * fraction of total RAM. Discrete GPUs compare against VRAM, with a
 * "can-run-slow" path when the surplus can be covered by system RAM.
 */
function classifyFit(modelSizeGB, hw) {
	if (hw.isMobile && !hw.isAppleSilicon && hw.totalUsableRAM) {
		const fraction = hw.platform === "iOS" ? 0.5 : 0.55;
		const usable = hw.totalUsableRAM * fraction;
		if (modelSizeGB <= usable * 0.7) return "can-run";
		if (modelSizeGB <= usable) return "tight";
		return "cannot-run";
	}
	if (hw.isAppleSilicon && hw.totalUsableRAM) {
		const usable = hw.totalUsableRAM * 0.75;
		if (modelSizeGB <= usable * 0.7) return "can-run";
		if (modelSizeGB <= usable) return "tight";
		return "cannot-run";
	}
	if (hw.estimatedVRAM) {
		if (modelSizeGB <= hw.estimatedVRAM * 0.85) return "can-run";
		if (modelSizeGB <= hw.estimatedVRAM * 1.1) return "tight";
		if (hw.systemRAM && hw.systemRAM > hw.estimatedVRAM) {
			const spillover = hw.systemRAM * 0.7;
			if (modelSizeGB <= hw.estimatedVRAM + spillover) return "can-run-slow";
		}
		return "cannot-run";
	}
	if (hw.totalUsableRAM) {
		const usable = hw.totalUsableRAM * 0.7;
		if (modelSizeGB <= usable * 0.7) return "can-run";
		if (modelSizeGB <= usable) return "tight";
		return "cannot-run";
	}
	return "unknown";
}

/**
 * Estimated inference throughput in tokens/sec. Uses memory bandwidth divided
 * by model size, multiplied by a platform efficiency factor. When the model
 * spills out of VRAM we model two tiers harmonically.
 */
function estimateTokensPerSec(modelSizeGB, hw) {
	if (!hw.memoryBandwidth) return null;

	let efficiency;
	if (hw.isMobile && !hw.isAppleSilicon) efficiency = 0.4;
	else if (hw.isAppleSilicon) efficiency = 0.65;
	else efficiency = 0.7;

	// Spillover case: a fraction of model lives in VRAM, rest in system RAM.
	if (hw.estimatedVRAM && modelSizeGB > hw.estimatedVRAM && hw.systemRAM) {
		const vramShare = Math.min(1, hw.estimatedVRAM / modelSizeGB);
		const ramShare = 1 - vramShare;
		const harmonicBW =
			1 /
			(vramShare / hw.memoryBandwidth + ramShare / SYSTEM_RAM_BANDWIDTH_GB_S);
		const tps = (harmonicBW / modelSizeGB) * efficiency * 0.85;
		return Math.max(1, Math.round(tps));
	}

	return Math.round((hw.memoryBandwidth / modelSizeGB) * efficiency);
}

/** Memory pressure as a percentage of available memory the model would use. */
function estimateMemoryPercent(modelSizeGB, hw) {
	if (hw.isMobile || hw.isAppleSilicon) {
		return hw.totalUsableRAM
			? Math.round((modelSizeGB / hw.totalUsableRAM) * 100)
			: null;
	}
	const budget = hw.estimatedVRAM || hw.totalUsableRAM;
	return budget ? Math.round((modelSizeGB / budget) * 100) : null;
}

/**
 * 0–100 score from fit status + tokens/sec + model size + memory %.
 * Higher = better experience. The piecewise curves and weights match the
 * heuristic the original site is calibrated with.
 */
function computeScore(status, toksPerSec, modelSizeGB, memPct = null) {
	if (status === "cannot-run" || status === "unknown") return 0;

	// Throughput component.
	let speedScore = 0;
	if (toksPerSec !== null) {
		if (toksPerSec >= 80) speedScore = 100;
		else if (toksPerSec >= 40)
			speedScore = linearMap(toksPerSec, 40, 80, 80, 100);
		else if (toksPerSec >= 20)
			speedScore = linearMap(toksPerSec, 20, 40, 55, 80);
		else if (toksPerSec >= 10)
			speedScore = linearMap(toksPerSec, 10, 20, 35, 55);
		else if (toksPerSec >= 5) speedScore = linearMap(toksPerSec, 5, 10, 15, 35);
		else speedScore = linearMap(Math.max(toksPerSec, 0), 0, 5, 0, 15);
	} else {
		speedScore = status === "can-run" ? 45 : 20;
	}

	// Memory-headroom component.
	let memScore = 45;
	if (memPct !== null) {
		if (memPct <= 20) memScore = 100;
		else if (memPct <= 40) memScore = linearMap(memPct, 20, 40, 100, 75);
		else if (memPct <= 60) memScore = linearMap(memPct, 40, 60, 75, 45);
		else if (memPct <= 80) memScore = linearMap(memPct, 60, 80, 45, 20);
		else memScore = linearMap(Math.min(memPct, 100), 80, 100, 20, 0);
	}

	// Bigger models get a small bonus (capped at 12 points).
	const sizeBonus = Math.min(12, Math.log2(modelSizeGB + 1) * 2);

	const statusPenalty =
		status === "can-run-slow" ? 0.6 : status === "tight" ? 0.75 : 1.0;
	return Math.round(
		(speedScore * 0.55 + memScore * 0.35 + sizeBonus) * statusPenalty,
	);
}

/** Letter grade derived from score+status. */
function computeGrade(score, status) {
	if (status === "cannot-run") return "F";
	if (status === "unknown") return "?";
	if (status === "can-run-slow") return score >= 40 ? "C" : "D";
	if (score >= 85) return "S";
	if (score >= 70) return "A";
	if (score >= 55) return "B";
	if (score >= 40) return "C";
	if (score >= 20) return "D";
	return "F";
}

/** Run all scoring for a single model. */
function scoreModel(modelSizeGB, hw, modelSizeForBonus) {
	const status = classifyFit(modelSizeGB, hw);
	const toksPerSec = estimateTokensPerSec(modelSizeGB, hw);
	const memPct = estimateMemoryPercent(modelSizeGB, hw);
	const score = computeScore(status, toksPerSec, modelSizeForBonus, memPct);
	const grade = computeGrade(score, status);
	return { status, toksPerSec, memPct, score, grade };
}

/** Visual styling for each letter grade. */
const GRADE_STYLES = {
	S: { letter: "S", label: "Runs great", color: "#22c55e" },
	A: { letter: "A", label: "Runs well", color: "#4ade80" },
	B: { letter: "B", label: "Decent", color: "#a3e635" },
	C: { letter: "C", label: "Tight fit", color: "#f59e0b" },
	D: { letter: "D", label: "Barely runs", color: "#f97316" },
	F: { letter: "F", label: "Too heavy", color: "#ef4444" },
	"?": { letter: "?", label: "Unknown", color: "#56565f" },
};

// ────────────────────────────────────────────────────────────────────────────
// User overrides (persisted in localStorage)
// ────────────────────────────────────────────────────────────────────────────

function loadOverrides() {
	try {
		const raw = localStorage.getItem(OVERRIDES_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveOverrides(o) {
	try {
		const filtered = {};
		if (o.device !== undefined) filtered.device = o.device;
		if (o.ramGB !== undefined) filtered.ramGB = o.ramGB;
		if (o.systemRAM !== undefined) filtered.systemRAM = o.systemRAM;
		if (o.memoryBandwidth !== undefined)
			filtered.memoryBandwidth = o.memoryBandwidth;
		if (o.gpuCores !== undefined) filtered.gpuCores = o.gpuCores;
		if (o.isAppleSilicon !== undefined)
			filtered.isAppleSilicon = o.isAppleSilicon;
		if (o.isMobile !== undefined) filtered.isMobile = o.isMobile;
		if (o.estimatedVRAM !== undefined) filtered.estimatedVRAM = o.estimatedVRAM;

		if (Object.keys(filtered).length === 0)
			localStorage.removeItem(OVERRIDES_KEY);
		else localStorage.setItem(OVERRIDES_KEY, JSON.stringify(filtered));
	} catch {
		/* ignore quota / privacy errors */
	}
}

/** Apply user overrides on top of a fresh detection result. */
function applyOverrides(hw, overrides) {
	const o = overrides ?? loadOverrides();
	if (Object.keys(o).length === 0) return hw;

	const out = { ...hw };
	if (o.isAppleSilicon !== undefined) out.isAppleSilicon = o.isAppleSilicon;
	if (o.isMobile !== undefined) out.isMobile = o.isMobile;
	if (o.estimatedVRAM !== undefined) out.estimatedVRAM = o.estimatedVRAM;
	if (o.ramGB !== undefined) {
		out.ramGB = o.ramGB;
		out.totalUsableRAM = o.ramGB;
	}
	if (o.systemRAM !== undefined) out.systemRAM = o.systemRAM;
	if (o.memoryBandwidth !== undefined) out.memoryBandwidth = o.memoryBandwidth;
	if (o.gpuCores !== undefined) out.gpuCores = o.gpuCores;
	return out;
}

/**
 * Resolve a device preset key (e.g. "apple:m3 pro", "gpu:RTX 4090") to a
 * partial hardware spec. Returns null for unknown keys.
 */
function resolveDevicePreset(key) {
	if (key.startsWith("apple:")) {
		const chip = key.slice(6);
		const spec = APPLE_SILICON[chip];
		return spec
			? {
					device: key,
					ramGB: spec.ram,
					memoryBandwidth: spec.bw,
					gpuCores: spec.gpuCores,
					isAppleSilicon: true,
					isMobile: false,
					estimatedVRAM: null,
				}
			: null;
	}
	if (key.startsWith("gpu:")) {
		const name = key.slice(4);
		const spec = DESKTOP_GPUS[name];
		return spec
			? {
					device: key,
					ramGB: spec.vram,
					memoryBandwidth: spec.bw,
					gpuCores: spec.cores,
					isAppleSilicon: false,
					isMobile: false,
					estimatedVRAM: spec.vram,
					systemRAM: 16,
				}
			: null;
	}
	if (key.startsWith("mobile:")) {
		const name = key.slice(7);
		const spec = MOBILE_GPUS[name];
		return spec
			? {
					device: key,
					ramGB: spec.ram,
					memoryBandwidth: spec.bw,
					isAppleSilicon: false,
					isMobile: true,
				}
			: null;
	}
	if (key.startsWith("sbc:")) {
		const name = key.slice(4);
		const spec = SBCS[name];
		return spec
			? {
					device: key,
					ramGB: spec.ram,
					memoryBandwidth: spec.bw,
					isAppleSilicon: false,
					isMobile: false,
					estimatedVRAM: null,
				}
			: null;
	}
	return null;
}

// ────────────────────────────────────────────────────────────────────────────
// UI helpers (dropdown population, auto-sizing)
// ────────────────────────────────────────────────────────────────────────────

const RAM_OPTIONS = [
	2, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192, 256, 384, 512,
];
const BANDWIDTH_OPTIONS = [
	50, 68, 100, 120, 150, 153, 200, 224, 256, 273, 288, 300, 307, 346, 360, 408,
	432, 448, 504, 546, 614, 672, 768, 819, 960, 1008, 1024, 1792, 2039, 3350,
	4000,
];

/** Merge a custom value into a sorted unique numeric option list. */
function mergeNumericOption(options, custom) {
	const set = new Set(options);
	if (custom !== null && custom > 0) set.add(custom);
	return Array.from(set).sort((a, b) => a - b);
}

/** Classify a desktop GPU name into a UI group. */
function gpuFamilyGroup(name) {
	if (
		name.includes("Ada") ||
		name.startsWith("RTX PRO") ||
		name.startsWith("RTX 6000") ||
		name.startsWith("RTX 4500") ||
		name.startsWith("RTX A") ||
		name.startsWith("Quadro") ||
		name.startsWith("NVIDIA T") ||
		/^T\d{3,4}$/.test(name)
	)
		return "NVIDIA Pro";
	if (/^(A100|H100|GH200|DGX Spark|L40S|L4|T4|Tesla P40)$/.test(name))
		return "NVIDIA Datacenter";
	if (name.startsWith("RTX 50")) return "NVIDIA RTX 50";
	if (name.startsWith("RTX 40")) return "NVIDIA RTX 40";
	if (name.startsWith("RTX 30")) return "NVIDIA RTX 30";
	if (name.startsWith("RTX 20")) return "NVIDIA RTX 20";
	if (name.startsWith("GTX 16")) return "NVIDIA GTX 16";
	if (name.startsWith("GTX 10")) return "NVIDIA GTX 10";
	if (name.startsWith("GTX 9")) return "NVIDIA GTX 9";
	if (name.startsWith("RX 9")) return "AMD RX 9000";
	if (name.startsWith("RX 7")) return "AMD RX 7000";
	if (name.startsWith("RX 6")) return "AMD RX 6000";
	if (name.startsWith("RX 5")) return "AMD RX 5000";
	if (name === "Radeon VII") return "AMD Older";
	if (
		name.startsWith("Radeon") ||
		name.startsWith("Ryzen") ||
		/^Vega \d$/.test(name)
	)
		return "AMD Integrated";
	if (name.startsWith("RX") || name.startsWith("Vega")) return "AMD Older";
	if (name.startsWith("Arc")) return "Intel Arc";
	if (name.startsWith("Iris") || name.startsWith("UHD"))
		return "Intel Integrated";
	return "Other";
}

const GROUP_ORDER = [
	"Apple Silicon",
	"NVIDIA RTX 50",
	"NVIDIA RTX 40",
	"NVIDIA RTX 30",
	"NVIDIA RTX 20",
	"NVIDIA GTX 16",
	"NVIDIA GTX 10",
	"NVIDIA GTX 9",
	"NVIDIA Pro",
	"NVIDIA Datacenter",
	"AMD RX 9000",
	"AMD RX 7000",
	"AMD RX 6000",
	"AMD RX 5000",
	"AMD Older",
	"AMD Integrated",
	"Intel Arc",
	"Intel Integrated",
	"Mobile",
	"SBC / Embedded",
];

/** Build the grouped option map for the device preset dropdown. */
function buildDevicePresetGroups() {
	const groups = {};
	for (const [chip, spec] of Object.entries(APPLE_SILICON)) {
		(groups["Apple Silicon"] ??= []).push({
			value: `apple:${chip}`,
			label: `${titleCase(chip)} (${spec.ram} GB)`,
		});
	}
	for (const [name, spec] of Object.entries(DESKTOP_GPUS)) {
		(groups[gpuFamilyGroup(name)] ??= []).push({
			value: `gpu:${name}`,
			label: `${name} (${spec.vram} GB)`,
		});
	}
	for (const [name, spec] of Object.entries(MOBILE_GPUS)) {
		const label = spec.ram ? `${name} (${spec.ram} GB)` : name;
		(groups["Mobile"] ??= []).push({ value: `mobile:${name}`, label });
	}
	for (const [name, spec] of Object.entries(SBCS)) {
		(groups["SBC / Embedded"] ??= []).push({
			value: `sbc:${name}`,
			label: `${name} — ${spec.ram} GB`,
		});
	}
	return groups;
}

// Single shared off-screen span used for measuring text widths.
let _measureSpan = null;
function getMeasureSpan() {
	if (!_measureSpan) {
		_measureSpan = document.createElement("span");
		_measureSpan.style.cssText =
			"visibility:hidden;position:absolute;white-space:nowrap;pointer-events:none";
	}
	if (!_measureSpan.isConnected) document.body.appendChild(_measureSpan);
	return _measureSpan;
}

/** Resize a <select> so it's exactly wide enough for its current option. */
function autosizeSelect(selectEl) {
	const span = getMeasureSpan();
	const text = selectEl.options[selectEl.selectedIndex]?.textContent ?? "";
	span.style.font = getComputedStyle(selectEl).font;
	span.textContent = text;
	selectEl.style.width = `${span.offsetWidth + 28}px`;
}

/**
 * Populate a numeric <select> with values + the special "detected" value
 * marked with a star, then apply the current override.
 */
function populateNumericSelect(
	selectEl,
	options,
	detectedValue,
	overrideValue,
	formatLabel,
) {
	const merged = mergeNumericOption(options, detectedValue);
	if (
		overrideValue !== undefined &&
		overrideValue > 0 &&
		!merged.includes(overrideValue)
	) {
		merged.push(overrideValue);
		merged.sort((a, b) => a - b);
	}

	selectEl.innerHTML = "";
	for (const v of merged) {
		const opt = document.createElement("option");
		opt.value = String(v);
		opt.textContent = formatLabel(v) + (v === detectedValue ? " ✱" : "");
		selectEl.appendChild(opt);
	}
	selectEl.value = String(overrideValue ?? detectedValue ?? "");
	autosizeSelect(selectEl);
}

/** Populate the grouped device <select> (Apple Silicon → NVIDIA → AMD → …). */
function populateDeviceSelect(selectEl, currentValue) {
	const groups = buildDevicePresetGroups();
	for (const groupName of GROUP_ORDER) {
		const items = groups[groupName];
		if (!items?.length) continue;
		const group = document.createElement("optgroup");
		group.label = groupName;
		for (const item of items) {
			const opt = document.createElement("option");
			opt.value = item.value;
			opt.textContent = item.label;
			if (item.value === currentValue) opt.selected = true;
			group.appendChild(opt);
		}
		selectEl.appendChild(group);
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export {
	DESKTOP_GPUS,
	APPLE_SILICON,
	MOBILE_GPUS,
	SBCS,
	RAM_OPTIONS,
	BANDWIDTH_OPTIONS,
	GROUP_ORDER,
	GRADE_STYLES,
	detectHardware,
	scoreModel,
	describeDevice,
	applyOverrides,
	loadOverrides,
	saveOverrides,
	resolveDevicePreset,
	buildDevicePresetGroups,
	populateDeviceSelect,
	populateNumericSelect,
	mergeNumericOption,
	autosizeSelect,
	titleCase,
};
