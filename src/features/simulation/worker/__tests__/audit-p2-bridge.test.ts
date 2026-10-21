import { describe, expect, it } from 'vitest';
import {
  setSimBusyListener,
  simClearBoardDamage,
  simSetCircuit,
  simSetPowered,
  simStartSketch,
  simStopSketch,
} from '../bridge';

/**
 * Audit P2 (tambahan) — pelacakan sibuk di bridge:
 * setiap perintah sesi harus melaporkan tepi sibuk [true … false]
 * ke listener terdaftar, termasuk jalur fallback sesi lokal
 * (di node tidak ada Worker → initSim tidak dipanggil di sini;
 * remote null & sesi lokal null, dispatch tetap dilacak).
 */
describe('bridge — pelacakan in-flight untuk indikator sibuk', () => {
  it('kelima perintah sesi masing-masing memancarkan true lalu false', () => {
    const events: boolean[] = [];
    setSimBusyListener((busy) => events.push(busy));
    simSetCircuit({ instances: [], pinHoles: {}, wires: [], boardId: 'uno' });
    simSetPowered(true);
    simStartSketch('void setup() {} void loop() {}');
    simStopSketch();
    simClearBoardDamage();
    setSimBusyListener(null);
    expect(events).toEqual([
      true, false,
      true, false,
      true, false,
      true, false,
      true, false,
    ]);
  });

  it('tanpa listener terdaftar, perintah tetap aman dipanggil', () => {
    setSimBusyListener(null);
    expect(() => simSetPowered(false)).not.toThrow();
  });
});
