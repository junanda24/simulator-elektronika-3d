import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildInspectorView,
  formatMilliAmps,
  inspectorViewsEqual,
  resetInspectorViewCache,
  selectInspectorView,
  type InspectorSelectorState,
} from '../inspectorFormat';
import type { ComponentInstanceState } from '../../shared/types';

/**
 * Kunci perilaku anti-kedip popover inspektor: kesetaraan pada PRESISI
 * TAMPIL. Jitter angka mentah solver di bawah 0,1 mA tidak boleh
 * menghasilkan view baru (= tidak ada cat ulang), sedangkan perubahan
 * yang benar-benar mengubah teks/status di layar harus seketika.
 */

function makeInstance(
  branchCurrents: Record<string, number>,
  isDamaged = false,
  id = 'inst-1',
): ComponentInstanceState {
  return {
    id,
    type: 'lm35',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState: {},
    simState: { pinVoltages: {}, branchCurrents, isDamaged },
  };
}

function stateOf(instances: ComponentInstanceState[], selectedId: string | null) {
  return { instances, selectedInstanceId: selectedId } satisfies InspectorSelectorState;
}

describe('formatMilliAmps', () => {
  it('membulatkan ke 0,1 mA', () => {
    expect(formatMilliAmps(0.01234)).toBe('12.3');
    expect(formatMilliAmps(-0.01234)).toBe('-12.3');
    expect(formatMilliAmps(0)).toBe('0.0');
  });

  it('arus negatif mungil yang membulat ke nol tercetak "0.0", bukan "-0.0"', () => {
    // Kasus screenshot user: arus out LM35 ≈ -0,04 mA tercetak "-0.0 mA".
    expect(formatMilliAmps(-0.00004)).toBe('0.0');
    expect(formatMilliAmps(-0.000049)).toBe('0.0');
    expect(formatMilliAmps(0.00002)).toBe('0.0');
  });

  it('pasangan jitter beda tanda di bawah presisi tampil menghasilkan teks sama', () => {
    expect(formatMilliAmps(-0.00001)).toBe(formatMilliAmps(0.00003));
  });

  it('nilai yang melewati batas 0,1 mA tetap bertanda & berubah', () => {
    expect(formatMilliAmps(-0.00006)).toBe('-0.1');
    expect(formatMilliAmps(-0.0004)).toBe('-0.4');
  });
});

describe('buildInspectorView + inspectorViewsEqual', () => {
  it('nama diambil dari registry plugin dan arus sudah terformat', () => {
    const view = buildInspectorView(makeInstance({ out: -0.00004 }));
    expect(view.name).toBe('Sensor Suhu LM35');
    expect(view.isDamaged).toBe(false);
    expect(view.currents).toEqual([{ key: 'out', text: '0.0' }]);
  });

  it('jitter mentah di bawah presisi tampil dianggap sama', () => {
    const a = buildInspectorView(makeInstance({ out: -0.00004 }));
    const b = buildInspectorView(makeInstance({ out: 0.00003 }));
    expect(inspectorViewsEqual(a, b)).toBe(true);
  });

  it('perubahan status rusak tidak pernah dianggap sama', () => {
    const a = buildInspectorView(makeInstance({ out: 0.001 }, false));
    const b = buildInspectorView(makeInstance({ out: 0.001 }, true));
    expect(inspectorViewsEqual(a, b)).toBe(false);
  });

  it('arus yang melintasi batas tampil tidak dianggap sama', () => {
    const a = buildInspectorView(makeInstance({ out: -0.00004 }));
    const b = buildInspectorView(makeInstance({ out: -0.00006 }));
    expect(inspectorViewsEqual(a, b)).toBe(false);
  });
});

describe('selectInspectorView (cache presisi tampil)', () => {
  beforeEach(() => {
    resetInspectorViewCache();
  });

  it('null bila tidak ada seleksi atau instance tidak ditemukan', () => {
    expect(selectInspectorView(stateOf([], null))).toBeNull();
    expect(selectInspectorView(stateOf([makeInstance({})], 'tidak-ada'))).toBeNull();
  });

  it('mengembalikan referensi yang SAMA selama teks tampil tidak berubah', () => {
    const first = selectInspectorView(stateOf([makeInstance({ out: -0.00004 })], 'inst-1'));
    // Snapshot solver berikutnya: objek instance BARU, angka mentah
    // berjitter di bawah 0,1 mA — persis rantai kedip saat drag slider.
    const second = selectInspectorView(stateOf([makeInstance({ out: 0.00001 })], 'inst-1'));
    const third = selectInspectorView(stateOf([makeInstance({ out: -0.00002 })], 'inst-1'));
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('status rusak berubah seketika menjadi view baru', () => {
    const normal = selectInspectorView(stateOf([makeInstance({ out: 0.001 })], 'inst-1'));
    const damaged = selectInspectorView(stateOf([makeInstance({ out: 0.001 }, true)], 'inst-1'));
    expect(damaged).not.toBe(normal);
    expect(damaged?.isDamaged).toBe(true);
  });

  it('arus yang melintasi batas 0,1 mA menghasilkan view baru dengan teks baru', () => {
    const before = selectInspectorView(stateOf([makeInstance({ out: -0.00004 })], 'inst-1'));
    const after = selectInspectorView(stateOf([makeInstance({ out: -0.0004 })], 'inst-1'));
    expect(after).not.toBe(before);
    expect(after?.currents).toEqual([{ key: 'out', text: '-0.4' }]);
  });

  it('ganti seleksi ke instance lain menghasilkan view instance itu', () => {
    selectInspectorView(stateOf([makeInstance({ out: 0.001 })], 'inst-1'));
    const other = selectInspectorView(
      stateOf([makeInstance({ main: 0.02 }, false, 'inst-2')], 'inst-2'),
    );
    expect(other?.id).toBe('inst-2');
    expect(other?.currents).toEqual([{ key: 'main', text: '20.0' }]);
  });
});
