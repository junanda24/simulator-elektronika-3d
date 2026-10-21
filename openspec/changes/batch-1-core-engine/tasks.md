# Tasks — Batch 1: Core Engine, Plugin Registry & Siklus "Rangkai → Nyala → Meledak"

Sumber: ROADMAP.md Batch 1. Status dicentang setelah terverifikasi, bukan setelah ditulis.

- [x] Setup proyek React 19 + Vite + TS + Tailwind v4 + dependency blueprint (three, R3F v9, drei, zustand, comlink, gsap, lz-string, CodeMirror)
- [x] Simpan 5 dokumen blueprint ke root proyek
- [x] Kontrak plugin di `src/shared/types/` (PinDefinition, ComponentInstanceState, ComponentPlugin, DamageReport, StampContext)
- [x] Solver MNA v1 (Gauss + gmin + iterasi PWL) di `src/features/simulation/solver/`
- [x] Plugin Resistor (meta + electrical) — konduktansi murni 1/R
- [x] Plugin LED 5mm (meta + electrical) — PWL 2-state, Vf per warna, aturan LED_OVERCURRENT & LED_REVERSE_BREAKDOWN
- [x] Tes angka spec: LED+resistor 12–14 mA; pembagi tegangan 2,5 V; LED tanpa resistor → damage; node mengambang → solusi hingga
- [x] Registry komponen di `src/shared/components/registry.ts`
- [x] Stage 3D: meja kerja ESD + kamera orbit terbatas + breadboard 830 (InstancedMesh + grid snapping matematis)
- [x] Board Uno R3 prosedural + silkscreen CanvasTexture
- [x] Model 3D Resistor (gelang warna dinamis) & LED (emissive mengikuti arus)
- [x] Demo scene: 5V → resistor → LED → GND menyala dari hasil solver
- [x] Damage Engine v1 UI: efek asap + Kartu Autopsi Kerusakan
- [x] Sistem wiring 3D interaktif (CatmullRom, warna kabel, hapus/pindah ujung)
- [x] Verifikasi akhir Batch 1: `npm test` hijau, `npm run build` hijau, cek arsitektur (tidak ada hardcode tipe komponen di core)
