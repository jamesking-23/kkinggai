import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { lockState, shouldRelock } from "./lock";
import { ScreenHeader } from "./ScreenHeader";
import { C } from "./theme";

type Phase = "checking" | "locked" | "open" | "no-lock";

/** Asks for the phone's own unlock (fingerprint, face, PIN or pattern) before showing the vault, and locks again after the app has been in the background for 30 seconds. If the phone has no screen lock the vault stays closed and says why. This protects the screen on the phone only; the vault on the website has its own sign-in. */
export function VaultLock({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [note, setNote] = useState<string | null>(null);
  const away = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setNote(null);
    setPhase("checking");
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (lockState(level) === "no-lock") return setPhase("no-lock");
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock your vault",
        cancelLabel: "Cancel",
      });
      if (r.success) return setPhase("open");
      setNote(r.error === "user_cancel" ? null : "Could not unlock. Try again.");
    } catch {
      setNote("Could not check your phone's lock. Try again.");
    }
    setPhase("locked");
  }, []);

  useEffect(() => {
    unlock();
  }, [unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (shouldRelock(away.current, Date.now())) setPhase("locked");
        away.current = null;
      } else if (away.current === null) {
        away.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  if (phase === "open") return <>{children}</>;
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Vault" onBack={onBack} />
      <View style={s.box}>
        {phase === "checking" && <ActivityIndicator color={C.primary} />}
        {phase === "locked" && (
          <>
            <Text style={s.title}>Vault locked</Text>
            <Text style={s.text}>Unlock with your phone's fingerprint, face, PIN or pattern.</Text>
            {note && <Text style={s.error}>{note}</Text>}
            <Pressable style={s.btn} onPress={unlock}>
              <Text style={s.btnText}>Unlock</Text>
            </Pressable>
          </>
        )}
        {phase === "no-lock" && (
          <>
            <Text style={s.title}>Set a screen lock first</Text>
            <Text style={s.text}>
              This phone has no fingerprint, face, PIN or pattern set, so the vault stays closed
              here. Set one in your phone's settings, then come back.
            </Text>
            <Pressable style={s.btn} onPress={unlock}>
              <Text style={s.btnText}>Check again</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { color: C.text, fontWeight: "700", fontSize: 18 },
  text: { color: C.muted, textAlign: "center", lineHeight: 20 },
  error: { color: C.danger },
  btn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
});
