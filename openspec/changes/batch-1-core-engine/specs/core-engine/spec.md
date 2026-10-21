# Spec — Batch 1: Core Engine

## Requirement: Solver MNA menghitung rangkaian DC secara benar

Sistem SHALL menyelesaikan tegangan node dan arus cabang rangkaian DC resistif + sumber tegangan Thevenin menggunakan Modified Nodal Analysis.

#### Scenario: LED dengan resistor yang benar
- WHEN pin 5V (Thevenin 5 V, R internal 1 Ω) dihubungkan ke resistor 220 Ω, lalu ke anoda LED merah (Vf 2,0 V, Ron 5 Ω), katoda ke GND
- THEN arus LED berada pada rentang 12–14 mA dan tegangan anoda ≈ 2,0 V di atas katoda

#### Scenario: Pembagi tegangan
- WHEN 5 V dihubungkan ke dua resistor 1 kΩ seri ke GND
- THEN node tengah bertegangan 2,5 V ± 0,05 V

## Requirement: LED tanpa resistor memicu kerusakan overcurrent

Sistem SHALL menandai LED rusak dengan aturan `LED_OVERCURRENT` bila arus LED melampaui 30 mA.

#### Scenario: LED langsung ke 5V
- WHEN anoda LED merah dihubungkan langsung ke pin 5V dan katoda ke GND, lalu solver dijalankan
- THEN arus LED > 30 mA dan `checkDamage` mengembalikan DamageReport dengan `ruleId: 'LED_OVERCURRENT'` berisi penjelasan edukasi berbahasa Indonesia

#### Scenario: LED terbalik melewati batas PIV
- WHEN katoda LED berada > 5,0 V di atas anoda
- THEN DamageReport `LED_REVERSE_BREAKDOWN` dikembalikan

## Requirement: Komponen terdaftar lewat plugin, tanpa ubah core

Sistem SHALL mengenali komponen hanya dari registrasi di `COMPONENT_REGISTRY`; modul solver dan stage TIDAK BOLEH mengandung percabangan berdasarkan nama/tipe komponen.

#### Scenario: Solver memproses instance generik
- WHEN solver menerima daftar instance komponen + kabel
- THEN solver memanggil `stampMNA` milik plugin masing-masing instance tanpa mengetahui tipe konkretnya

## Requirement: Node mengambang tidak membuat solver gagal

Sistem SHALL tetap menghasilkan solusi hingga (finite) untuk node yang tidak terhubung ke mana pun, dengan menyuntikkan konduktansi bocor sangat kecil (gmin) ke GND.

#### Scenario: Pin tidak terhubung
- WHEN sebuah instance memiliki pin yang tidak terkoneksi kabel apa pun
- THEN solver selesai tanpa NaN/Infinity pada seluruh tegangan node
