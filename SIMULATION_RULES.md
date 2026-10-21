# SIMULATION_RULES.md — Aturan Fisika Elektrik, Kerusakan & Interaksi 3D

## 1. Mesin Modified Nodal Analysis (MNA)

Solver menghitung tegangan pada setiap *node* dan arus pada setiap sumber tegangan pada setiap *tick* simulasi menggunakan persamaan matriks:

$$G \cdot v = i$$

Di mana $G$ adalah matriks konduktansi ($\frac{1}{R}$), $v$ adalah vektor tegangan node yang dicari, dan $i$ adalah vektor sumber arus/tegangan independen.

### Pemodelan Komponen di Matriks MNA:
1. **Kabel & Jalur Breadboard:** Menggabungkan dua *node* menjadi satu *node* ekuivalen (resistansi $0\ \Omega$) atau menggunakan konduktansi sangat tinggi ($R = 0.001\ \Omega$) agar arus pendek (*short-circuit*) pada kabel spesifik tetap dapat diukur arusnya dan diwarnai merah saat korsleting.
2. **Resistor & Potensiometer:** Komponen linear murni dengan konduktansi $G = \frac{1}{R}$. Untuk potensiometer 3 kaki (A, Wiper, B) dengan posisi putaran $\alpha \in [0.001, 0.999]$:
   - $R_{A-Wiper} = R_{total} \times \alpha$
   - $R_{Wiper-B} = R_{total} \times (1 - \alpha)$
3. **LED & Dioda (Piecewise-Linear / PWL 2-State Model):**
   - Menghindari iterasi Newton-Raphson yang lambat dengan memodelkan LED dalam 2 kondisi:
   - **State OFF ($V_{anoda} - V_{katoda} < V_f$):** Dimodelkan sebagai resistor bocor sangat besar ($R_{off} = 10\text{ M}\Omega$).
   - **State ON ($V_{anoda} - V_{katoda} \ge V_f$):** Dimodelkan sebagai sumber tegangan seri sebesar $V_f$ (misal $2.0\text{ V}$ untuk LED Merah, $3.0\text{ V}$ untuk LED Biru/Putih) dengan resistansi dalam dinamis $R_{on} = 5\ \Omega$.
   - Kecerahan visual LED di 3D dihitung dari rasio arus aktual terhadap arus nominal: $\text{Intensity} = \text{clamp}\left(\frac{I_{aktual}}{20\text{ mA}}, 0, 1.5\right)$.
4. **Pin GPIO Mikrokontroler:**
   - `INPUT`: Impedansi tinggi ($R_{in} = 10\text{ M}\Omega$). Jika tegangan node mengambang (tidak terhubung ke mana pun), injeksikan *noise* acak kecil agar pengguna belajar mengapa tombol butuh *pull-up/pull-down resistor*.
   - `INPUT_PULLUP`: Menghubungkan resistor internal ($20\text{ k}\Omega - 45\text{ k}\Omega$) dari pin ke $V_{cc}$ logika board.
   - `OUTPUT HIGH`: Sumber tegangan sebesar $V_{logic}$ ($5.0\text{ V}$ untuk Uno, $3.3\text{ V}$ untuk ESP32/NodeMCU/Pico) dengan resistansi dalam pin $R_{pin} = 25\ \Omega$.
   - `OUTPUT LOW`: Terhubung ke `GND` ($0\text{ V}$) melalui resistansi dalam pin $R_{pin} = 25\ \Omega$.

---

## 2. Matriks Aturan Kerusakan (Damage & Consequence Rules)

Setiap selesai satu *tick* kalkulasi MNA, modul `damage/` memeriksa ambang batas berikut. Jika terlampaui, status komponen/pin berubah menjadi `isDamaged = true` dan simulasi memicu **Mode Autopsi**.

| ID Aturan | Kondisi Pemicu (Trigger) | Efek Visual & Fisik di 3D | Penjelasan Autopsi (Edukasi) |
| :--- | :--- | :--- | :--- |
| **`LED_OVERCURRENT`** | $I_{LED} > 30\text{ mA}$ (tanpa resistor atau resistor terlalu kecil) | Kilatan cahaya terang sesaat, disusul suara *pop*, kubah LED menghitam, dan keluar kepulan asap tipis. | LED membutuhkan pembatas arus. Menghubungkan LED langsung ke sumber tegangan membuat arus melonjak drastis ($I = (V_s - V_f) / R_{on}$) dan membakar semikonduktor di dalamnya. |
| **`LED_REVERSE_BREAKDOWN`** | $V_{katoda} - V_{anoda} > 5.0\text{ V}$ | LED mati total dan muncul ikon keretakan mikro. | Polaritas LED terbalik melebihi tegangan *Peak Inverse Voltage* ($5\text{ V}$), menembus batas isolasi dioda. |
| **`MCU_PIN_OVERVOLTAGE`** | Tegangan pada pin GPIO board $3.3\text{V}$ (ESP32, NodeMCU, Pico) mencapai $> 3.6\text{ V}$ | Percikan api pada chip utama MCU, muncul tanda silang merah (`✕`) melayang di atas pin yang bersangkutan. Pin mati permanen. | Board modern seperti ESP32 dan Pico bekerja pada logika $3.3\text{V}$ dan **tidak toleran terhadap sinyal $5\text{V}$**. Gunakan *Logic Level Converter* atau rangkaian pembagi tegangan (*Voltage Divider*). |
| **`MCU_PIN_OVERCURRENT`** | Arus keluar/masuk satu pin GPIO $> 40\text{ mA}$ (Uno) atau $> 28\text{ mA}$ (ESP32/Pico) | Jalur kabel menyala merah membara (efek *thermal*), pin GPIO mati. | Pin GPIO hanya dirancang untuk mengirim sinyal logika, bukan menyuplai daya ke beban berat (seperti motor atau banyak LED sekaligus) tanpa transistor/driver. |
| **`POWER_SHORT_CIRCUIT`** | Arus dari pin `5V` atau `3.3V` langsung ke `GND` menyebabkan $I_{total} > 500\text{ mA}$ | Kabel yang korslet menyala merah terang berdenyut, regulator tegangan di board berasap, dan port USB virtual otomatis memutus arus. | Terjadi hubungan arus pendek (*short circuit*) antara jalur positif dan Ground tanpa beban. Di dunia nyata, ini membuat regulator board terbakar atau memicu *polyfuse* USB komputer mati. |
| **`INDUCTIVE_BACK_EMF`** | Motor DC atau koil Relay dihubungkan langsung ke pin GPIO tanpa modul driver / dioda *flyback* | Pin GPIO rusak sesaat setelah berstatus `HIGH` lalu diubah ke `LOW`. | Kumparan motor/relay menyimpan energi magnetik. Saat arus diputus mendadak, kumparan menghasilkan lonjakan tegangan balik (*Back-EMF*) bernilai puluhan volt yang menghancurkan pin mikrokontroler. |
| **`SERVO_STALL_OVERLOAD`** | Servo menarik arus *stall* ($> 500\text{ mA}$) langsung dari pin regulator `5V` board saat beban dikunci di 3D | Board mengalami *brownout* (restart berulang-ulang) atau regulator panas berlebih. | Saat servo menahan beban berat atau macet, arusnya melonjak drastis. Menarik daya servo langsung dari regulator board menyebabkan tegangan drop (*brownout*) yang me-reset mikrokontroler. |

---

## 3. Aturan Interaksi 3D Langsung (Tactile 3D Manipulation)

Semua pengujian sensor dan input dilakukan **langsung pada objek 3D di atas meja kerja**, bukan melalui form tersembunyi di sidebar:

1. **Push Button & Keypad 4x4:** Klik kiri dan tahan langsung pada tutup tombol 3D untuk menekan (terdengar bunyi *klik* halus dan tombol turun $0.8\text{ mm}$). Tambahkan opsi `Shift + Klik` untuk mengunci tombol tetap tertekan (*latching hold*) agar pengguna mudah menguji kode.
2. **Potensiometer & Joystick:** Klik dan seret (*drag* melingkar atau geser) langsung pada poros/tongkat 3D untuk memutar sudut potensiometer atau menggerakkan sumbu X/Y joystick secara *real-time*.
3. **Sensor Ultrasonik (HC-SR04):** Saat sensor dipasang, muncul objek **Papan Pantul 3D** di depan sensor lengkap dengan garis ukur laser putus-putus (`24.5 cm`). Pengguna cukup menggeser papan pantul tersebut maju/mundur di ruang 3D untuk mengubah waktu pantulan *Echo*.
4. **Sensor Cahaya (LDR):** Muncul objek **Lampu Senter Virtual 3D** melayang di atas LDR yang bisa digeser naik-turun untuk mengatur intensitas cahaya ($0 - 1000\text{ Lux}$) lengkap dengan efek kerucut cahaya.
5. **Sensor Lingkungan (DHT11, Soil Moisture, PIR):** Memiliki *3D Floating Micro-Widget* tepat di atas komponen saat disorot:
   - **DHT11:** Cincin geser suhu ($0^\circ\text{C} - 50^\circ\text{C}$) & kelembapan ($20\% - 90\%$).
   - **PIR:** Tombol "Simulasikan Gerakan Tangan" yang menggerakkan siluet objek hangat di depan lensa Fresnel 3D.
   - **Servo SG90:** Memiliki tombol "Kunci Beban (Simulasi Macet)" langsung pada lengan servo 3D untuk mendemonstrasikan bahaya *stall current*.
