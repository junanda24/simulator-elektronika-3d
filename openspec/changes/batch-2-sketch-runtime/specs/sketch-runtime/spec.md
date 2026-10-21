# Spec — Sketch Runtime (Batch 2)

## Skenario wajib lolos (tes otomatis)
- Sketch blink: pinMode(13, OUTPUT) lalu digitalWrite HIGH/LOW berselang delay — arus LED pada rangkaian D13 berubah mengikuti level pin.
- analogRead pada net hasil pembagi tegangan mengembalikan nilai ADC proporsional (Uno: 0..1023 @ 5 V).
- digitalRead pada pin INPUT_PULLUP yang tidak terhubung membaca HIGH; setelah net-nya ditarik ke GND membaca LOW.
- while(true) tanpa delay TIDAK membekukan worker (LOOP_GUARD menyerahkan kendali berkala).
- Kesalahan sintaks menghasilkan pesan galat berbahasa Indonesia dengan nomor baris; tidak ada kode dieksekusi.
- LED langsung di pin D13 (tanpa resistor) → event MCU_PIN_OVERCURRENT, pin mati, autopsi board tampil.
- Kabel rel 5V langsung ke GND → POWER_SHORT_CIRCUIT, semua sumber padam.
- Push button tertekan mengubah konektivitas A↔B; potensiometer alpha membagi resistansi sesuai rumus wiper.
