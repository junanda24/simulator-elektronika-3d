import { describe, expect, it } from 'vitest';
import { useUiSettings } from '../uiSettings';

/**
 * Setelan tampilan: visibilitas panel samping (katalog kiri & dock
 * kanan) mengikuti pola persistensi uiSettings — bawaan tampil, setter
 * membalik keadaan. Di lingkungan tes tanpa localStorage, pembacaan
 * jatuh ke bawaan dan penulisan diabaikan diam-diam (kontrak readBool/
 * writeBool) — yang dikunci di sini logika store-nya.
 */
describe('useUiSettings — visibilitas panel', () => {
  it('bawaan: kedua panel tampil, turntable mati, badge nyala', () => {
    const s = useUiSettings.getState();
    expect(s.catalogVisible).toBe(true);
    expect(s.dockVisible).toBe(true);
    expect(s.turntable).toBe(false);
    expect(s.showBadges).toBe(true);
  });

  it('setter katalog & dock bekerja independen, lalu dikembalikan', () => {
    const s = useUiSettings.getState();
    s.setCatalogVisible(false);
    expect(useUiSettings.getState().catalogVisible).toBe(false);
    expect(useUiSettings.getState().dockVisible).toBe(true);
    s.setDockVisible(false);
    expect(useUiSettings.getState().dockVisible).toBe(false);
    s.setCatalogVisible(true);
    s.setDockVisible(true);
    expect(useUiSettings.getState().catalogVisible).toBe(true);
    expect(useUiSettings.getState().dockVisible).toBe(true);
  });
});
