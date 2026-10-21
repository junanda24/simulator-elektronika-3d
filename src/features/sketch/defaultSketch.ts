/**
 * Sketch bawaan: blink LED lewat pin D13 — pasangan rangkaian demo.
 * Ditulis sebagai sketch Arduino asli agar langsung bisa diedit user.
 */
export const DEFAULT_SKETCH = `// Sketch pertama: kedip LED lewat pin D13
// Coba ubah angka delay-nya, lalu tekan Upload & Jalankan.

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink dimulai!");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED nyala");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("LED mati");
  delay(1000);
}
`;
