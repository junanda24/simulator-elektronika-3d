# Proposal — Batch 10: Realisme Visual Board & Objek 3D

Permintaan user: board dan objek 3D masih terasa kurang realistis — tingkatkan tanpa menyentuh logika/interaksi/posisi pin.

## Yang dibangun
1. Breadboard: label tercetak prosedural ala MB-102 (CanvasTexture dari konstanta grid nyata): angka baris tiap 5, huruf kolom a–e/f–j, tanda rel + merah / − biru, merek "MB-102 · 830 TIE-POINT".
2. Board generik (ESP32/NodeMCU/Pico): jejak PCB samar di canvas silkscreen (Manhattan, alpha rendah, sebelum label) + sekrup sudut metalik berslot.
3. Board Uno: lubang tengah jack daya, jejak PCB di silkscreen, penegasan soket header.
4. Komponen: kubah LED/RGB menjadi meshPhysicalMaterial clearcoat (rasa epoxy; logika emissive & pointLight utuh); garis skor tutup kapasitor; sekrup kuping servo; pita label motor DC. 15 model lain diaudit dan dinyatakan sudah memenuhi target material (kaki metalness 0.9/roughness 0.3, plastik 0.4–0.65, gelang resistor dari nilai) — tidak diubah.

## Keputusan
Transmission pada kubah LED tidak dipakai: berisiko mencuci emissive berbasis arus dan menambah render pass; clearcoat cukup.
