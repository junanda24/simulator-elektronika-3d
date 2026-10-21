# Design — Batch 1: Core Engine

Dokumen pengarah utama: `ARCHITECTURE.md`, `TECH_STACK.md`, `SIMULATION_RULES.md`, `STYLE_GUIDE.md`, `ROADMAP.md` di root proyek. Dokumen ini mencatat keputusan teknis turunan untuk change Batch 1.

## Kontrak solver (turunan dari ARCHITECTURE.md §3)

- Solver adalah fungsi murni TypeScript di `src/features/simulation/solver/` — tidak tahu nama komponen apa pun (zero-core-touch). Ia menerima daftar instance + peta pin→net + daftar sumber Thevenin, lalu memanggil `electrical.stamp()` milik plugin tiap instance.
- `StampContext` menyediakan: `netOf(instanceId, pinId)`, `prevVoltage(net)` (untuk iterasi PWL), `conductance(a, b, g)`, `current(from, to, amps)`, `thevenin(net, volts, seriesOhms)` (ekuivalen Norton terhadap GND).
- Net `GND` adalah node referensi (tidak masuk matriks). Semua node lain mendapat konduktansi bocor `gmin = 1e-9 S` ke GND agar node mengambang tidak membuat matriks singular.
- Sistem linear diselesaikan dengan eliminasi Gauss + partial pivoting.
- LED memakai PWL 2-state per SIMULATION_RULES.md §1.3: solver beriterasi maksimal 8 kali sampai state semua LED stabil (atau iterasi habis).
- Setelah solusi final: tiap plugin menghitung arus cabangnya via `computeCurrents(instance, voltages)`, lalu `checkDamage(instance, result)` dievaluasi. Kerusakan bersifat persisten pada instance (tidak auto-sembuh).

## Pembagian kepemilikan file (kerja paralel)

- **Simulation engine**: `src/features/simulation/**`, `src/shared/components/catalog/*/electrical.ts` + `meta.ts`, tes di `src/features/simulation/__tests__/`.
- **Stage 3D**: `src/app/**`, `src/features/stage3d/**`, `src/shared/components/catalog/*/model3d.tsx`, `src/shared/boards/uno/**`.
- **Integrasi (Vex)**: `src/shared/types/**` (dikunci sebelum paralel), perakitan `catalog/*/index.ts` + `registry.ts`, verifikasi akhir (tes + build).

## State (lima keranjang)

- State sirkuit (instance, kabel, board aktif): Zustand — keranjang klien global.
- Snapshot simulasi: data turunan dari Worker (Batch 1: dihitung sinkron dari modul yang sama; pemindahan ke Worker menyusul tanpa mengubah kontrak).
- State lokal UI (hover, seleksi): useState komponen.
- Server state & form: tidak ada (tanpa backend, tanpa login).

## Alasan tidak memakai emulator CPU / ngspice

Sesuai TECH_STACK.md §3: transpiler sketch → async generator (Batch 2) dan solver MNA mandiri memberi kontrol penuh atas aturan kerusakan edukatif, tanpa beban WASM/lisensi AGPL.
