# Proposal — Batch 7: Gizmo 3D & Komponen Taktil

## Yang dibangun
1. SensorGizmo3D (panel drei Html: label + nilai + slider, stopPropagation) dan RotaryKnobGizmo (pembaca % + Ω) di src/features/stage3d/gizmos/.
2. Gizmo per sensor saat komponen terpilih: LDR (lux + kerucut cahaya), LM35 (suhu; warna badan biru→oranye→merah), soil-moisture (%; warna tanah kering→basah), potensiometer (% + Ω).
3. Gerak mekanis halus: tanduk servo lerp eksponensial ke sudut target; joystick pegas kembali ke tengah (throttle interact 33 ms); kubah PIR berdenyut saat motion; badan tilt-switch miring teranimasi.
4. Semua handler drag membungkus setDragging3D agar OrbitControls terkunci selama manipulasi.

## Catatan keputusan
LED & RGB LED tidak diubah: keduanya sudah memiliki pointLight berwarna yang digerakkan arus dengan skala fisik yang sudah ter-tuning.
