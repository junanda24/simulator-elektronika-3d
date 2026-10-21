# Proposal — Batch 3: Multi-Board & Aturan Overvoltage

Blueprint: ROADMAP.md Batch 3. Lanjutan batch-2-sketch-runtime (selesai).

## Yang dibangun
1. BoardDefinition generik (data murni, tanpa React): pinout, profil elektrik, rel daya, pin demo — untuk Arduino Uno (migrasi dari pins.ts), ESP32 DevKit, NodeMCU ESP8266, Raspberry Pi Pico.
2. Netlist & sesi digeneralisasi ke board aktif (bukan Uno hardcoded); toolbar pemilih board berfungsi; ganti board membuang kabel yang menyentuh pin board lama.
3. Model 3D prosedural ketiga board baru (ESP32: modul kaleng RF; NodeMCU: modul di carrier; Pico: PCB hijau + chip RP2040).
4. Aturan MCU_PIN_OVERVOLTAGE: pin board 3,3 V yang terkena tegangan di atas logika + 0,5 V (klasik: 5 V Uno-style masuk GPIO ESP32/Pico) → pin mati + autopsi board. Berlaku juga untuk pin yang belum dikonfigurasi sketch.
5. Demo & sketch bawaan menyesuaikan pin LED onboard per board (Uno D13, ESP32 D2, NodeMCU D4, Pico D25).

## Di luar scope
Lesson & share (Batch 4), katalog besar (Batch 5), alias pin ganda Pico (GP26 vs A0 — satu id per pin: A0).
