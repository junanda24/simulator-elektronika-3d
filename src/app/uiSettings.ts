import { create } from "zustand";

// Setelan tampilan ringan (bukan state rangkaian). Pola persistensi mengikuti
// soundFx: localStorage dengan awalan "sim3d:", dibaca sekali saat modul
// dimuat, ditulis setiap kali berubah. Kegagalan akses storage diabaikan.
function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // storage tidak tersedia (mode privat dsb.) — setelan cukup hidup di sesi ini
  }
}

interface UiSettings {
  /** Kamera berputar pelan sendiri saat meja idle (opt-in, default mati). */
  turntable: boolean;
  /** Badge nilai live di atas komponen bintang (default nyala). */
  showBadges: boolean;
  setTurntable: (value: boolean) => void;
  setShowBadges: (value: boolean) => void;
}

export const useUiSettings = create<UiSettings>((set) => ({
  turntable: readBool("sim3d:turntable", false),
  showBadges: readBool("sim3d:badges", true),
  setTurntable: (value) => {
    writeBool("sim3d:turntable", value);
    set({ turntable: value });
  },
  setShowBadges: (value) => {
    writeBool("sim3d:badges", value);
    set({ showBadges: value });
  },
}));
