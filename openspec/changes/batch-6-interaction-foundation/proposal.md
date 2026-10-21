# Proposal — Batch 6: Fondasi Interaksi (State Transien, Rotasi, Undo, Audio)

Lanjutan dari master plan interaktivitas (Batch 6–9 versi user) + tambahan user: undo.

## Yang dibangun
1. State transien di circuitStore: isDragging3D (kunci OrbitControls), placementRotation, wireCursorPos.
2. Rotasi placement generik di computePlacement (parameter rotationDeg; footprint dirotasikan dalam ruang grid lubang; hasil rotasi 0 identik perilaku lama).
3. Undo/redo: snapshot deep-clone {instances, pinHoles, wires}, batas 50, dicatat sebelum mutasi struktural (bukan interact — drag kontinu), reset pada scene baru.
4. soundFx.ts: synthesizer Web Audio murni (snap, klik, burn pop, nada buzzer persisten), preferensi persisten localStorage.

## Yang dipertahankan
Seluruh API store lama; tidak ada state/action yang diubah namanya.
