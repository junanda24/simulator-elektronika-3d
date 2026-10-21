import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';

/**
 * pulseIn bukan stub lagi (gelombang HC-SR04, 2026-10-21): ia builtin
 * runtime asli yang destrukturisasi dari __api dan di-await seperti
 * pemanggilan fungsi lain. Tes ini mengunci sisi transpiler-nya; sisi
 * perilaku di pulsein-runtime.test.ts & hc-sr04-session.test.ts.
 */
describe('transpiler — pulseIn builtin asli', () => {
  const SKETCH = `
const int trigPin = 7;
const int echoPin = 6;
void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long durasi = pulseIn(echoPin, HIGH);
  long cm = durasi / 58;
  Serial.println(cm);
  delay(200);
}`;

  it('sketch ukur jarak klasik lolos transpile tanpa error', () => {
    const { code, error } = transpileSketch(SKETCH);
    expect(error).toBeNull();
    expect(code).not.toBeNull();
  });

  it('pulseIn datang dari __api (bukan stub __belumDidukung) dan di-await', () => {
    const { code } = transpileSketch(SKETCH);
    expect(code).toContain('pulseIn');
    expect(code).toContain('await pulseIn(');
    expect(code).not.toContain('sensor ultrasonik HC-SR04 belum tersedia');
    expect(code).not.toContain("__belumDidukung('pulseIn'");
  });

  it('pulseIn dengan argumen timeout juga lolos', () => {
    const { code, error } = transpileSketch(`
void setup() {}
void loop() {
  long d = pulseIn(6, HIGH, 30000);
  Serial.println(d);
  delay(100);
}`);
    expect(error).toBeNull();
    expect(code).toContain('await pulseIn(');
  });
});
