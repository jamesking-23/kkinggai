import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  BOARD_PREFS_KEY,
  DEFAULT_BOARD_PREFS,
  sanitizeBoardPrefs,
  type BoardPrefs,
} from "./boardPrefs";

let current: BoardPrefs = DEFAULT_BOARD_PREFS;
let loaded = false;
const listeners = new Set<(p: BoardPrefs) => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(BOARD_PREFS_KEY);
    if (raw) {
      current = sanitizeBoardPrefs(JSON.parse(raw));
      listeners.forEach((l) => l(current));
    }
  } catch {
    // storage unavailable or corrupt: keep the defaults
  }
}

export async function updateBoardPrefs(patch: Partial<BoardPrefs>) {
  current = sanitizeBoardPrefs({ ...current, ...patch });
  listeners.forEach((l) => l(current));
  try {
    await AsyncStorage.setItem(BOARD_PREFS_KEY, JSON.stringify(current));
  } catch {
    // the change still applies for this session
  }
}

/** The saved board look; every board on screen updates when it changes. */
export function useBoardPrefs(): BoardPrefs {
  const [p, setP] = useState(current);
  useEffect(() => {
    listeners.add(setP);
    void load();
    setP(current);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
