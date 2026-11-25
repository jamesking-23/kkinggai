import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { keyboardOverlap } from "./assistantFormat";

/**
 * How far the on-screen keyboard covers the bottom of `ref`'s view, to be used as bottom padding. It measures instead of
 * assuming, so it works whether or not Android also resizes the window (with edge-to-edge screens it does not, which is
 * why a plain layout let the keyboard cover the text box). When the window does resize, the view's own layout change
 * re-measures it and the padding drops back to zero, so the two never add up.
 */
/** The one method of a view this hook needs (React Native's ref types differ between versions, so it is described here). */
export type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

export function useKeyboardOverlap(ref: React.RefObject<Measurable | null>) {
  const [overlap, setOverlap] = useState(0);
  const top = useRef<number | null>(null);

  const measure = useCallback(() => {
    const kb = top.current;
    if (kb === null) return setOverlap(0);
    // The padding sits inside this view, so the view's own bottom edge does not move when the overlap changes.
    ref.current?.measureInWindow((_x, y, _w, h) => setOverlap(keyboardOverlap(y + h, kb)));
  }, [ref]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
      (e) => {
        top.current = e.endCoordinates.screenY;
        measure();
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        top.current = null;
        setOverlap(0);
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measure]);

  return { overlap, onLayout: measure };
}
