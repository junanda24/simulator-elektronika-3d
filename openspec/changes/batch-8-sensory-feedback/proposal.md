# Proposal — Batch 8: Umpan Balik Sensorik (Arus Terlihat, Kabel Membara, Ledakan, Bunyi)

## Yang dibangun
1. WireMesh3D (ekstraksi render kabel dari Workbench): klik untuk memilih, emissive seleksi, thermal glow merah berdenyut bila boardFault dan kabel menyentuh net GND/rel.
2. CurrentFlowDots: titik cahaya mengalir sepanjang kurva kabel; arah & kecepatan dari gradien tegangan antar net (snapshot MNA) — pendekatan terdokumentasi karena arus per kabel bukan besaran langsung solver.
3. DanglingWirePreview: kabel elastis CatmullRom dari pin pertama mengikuti kursor (wireCursorPos), menggantikan garis putus-putus lurus.
4. GhostPlacementMesh: model komponen asli transparan + selubung validitas hijau/merah, click-through (raycast dimatikan pada subtree ghost).
5. Smoke berlapis: playBurnPop sekali saat mount, 12 percikan api bergravitasi (0,4 dtk), kilatan pointLight oranye (±0,25 dtk), getaran kamera 250 ms yang membatalkan diri bila kamera digerakkan hal lain, asap lama dipertahankan.
6. Buzzer berbunyi nyata (updateBuzzerTone 2400 Hz saat arus main > 5 mA) + cincin gelombang suara; relay berbunyi playClick(1200) setiap kontak berpindah.
