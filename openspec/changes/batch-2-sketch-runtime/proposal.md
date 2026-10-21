# Proposal — Batch 2: Sketch Runtime & Komponen Interaktif

Blueprint: ROADMAP.md Batch 2. Lanjutan batch-1-core-engine (selesai).

## Yang dibangun
1. Transpiler sketch Arduino (subset C++) → async JS: setup/loop, variabel, if/for/while, fungsi buatan user, pinMode/digitalWrite/digitalRead/analogWrite/analogRead/delay/millis, Serial.print/println. LOOP_GUARD anti-freeze.
2. Runtime sketch berjalan di Web Worker yang sama dengan solver: setiap tulis/baca pin memicu solve sinkron, snapshot periodik ke UI (tegangan, arus, serial, state pin).
3. Editor CodeMirror + Serial Monitor di Right Dock (STYLE_GUIDE §5).
4. Komponen interaktif pertama: Push Button (klik 3D, momentary + latch Shift) & Potensiometer (putar 3D, model wiper dua resistor).
5. Aturan kerusakan board: MCU_PIN_OVERCURRENT (pin mati permanen sampai board diganti) & POWER_SHORT_CIRCUIT (rel daya ke GND, board fault).
6. Demo v2: rangkaian blink D13 + sketch bawaan.

## Di luar scope
Multi-board (Batch 3), lesson & share (Batch 4), katalog besar (Batch 5), tone()/Servo (Batch 5), pembagian integer ala C++ (semantik JS dipakai; dicatat sebagai penyederhanaan).
