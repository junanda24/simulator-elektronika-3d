# Proposal — Batch 5: Katalog Komponen Lengkap (20 Tipe)

Blueprint: ROADMAP.md Batch 5.

## Yang dibangun
Katalog diperluas dari 4 menjadi 20 tipe komponen plug-and-play (kontrak ComponentPlugin, zero-core-touch), dikerjakan dalam 3 gelombang:

1. **Gelombang 5A** — helper bersama `createPwlDiode` + `combineElectrical` (src/shared/components/pwlDiode.ts) dan tabel placement generik COLUMN_SPECS: kapasitor elektrolit (damage CAP_REVERSE_POLARITY / CAP_OVERVOLTAGE), dioda silikon 1N4007, transistor NPN 2N2222 (model saklar β + saturasi, damage TRANSISTOR_OVERCURRENT), modul relay 5V (kontak NO/NC), LED RGB katoda umum (3 kanal PWL).
2. **Gelombang 5B** — sensor: LDR (resistansi logaritmik terhadap cahaya, drag), PIR (klik kubah = gerakan, OUT Thevenin), LM35 (OUT = suhu × 10mV, drag), joystick analog (VRX/VRY Thevenin + tombol SW), sensor kelembaban tanah (AO = VCC × (1 − kelembaban), drag).
3. **Gelombang 5C** — aktuator/display/pelindung: servo SG90 (sudut = rasio tegangan rata-rata SIG — simplifikasi terdokumentasi dari pulsa 1–2ms), motor DC (klik = poros terkunci → damage MOTOR_STALL), buzzer aktif (peka polaritas), display 7-segment (8× dioda PWL per segmen), sekering (damage FUSE_BLOWN → rangkaian terbuka), saklar miring (klik = toggle).

## Di luar cakupan (keputusan sadar)
- **HC-SR04 & DHT22**: protokol digital berbasis pewaktuan pulsa tidak bisa dimodelkan jujur oleh solver DC tunak — diganti LM35 + sensor kelembaban tanah.
- **LCD/OLED/RTC/keypad**: protokol I2C/library di luar kemampuan transpiler sketch saat ini.
- Buzzer: suara WebAudio belum disambungkan; perilaku elektrik + visual (emissive) lengkap.

## Skenario wajib lolos
- Setiap komponen terdaftar di registry, electricalRegistry, catalogMeta, dan catalogData.
- Tes elektrik per gelombang membuktikan fisika utamanya (arus/tegangan dalam rentang yang dihitung manual) dan aturan kerusakannya.
- Seluruh tes proyek hijau dan build produksi bersih.
