import { useEffect, useRef, useState, useCallback } from "react";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

/**
 * Client-side idle-session timeout (Point 14 — Security Features).
 * The JWT itself is stateless and keeps its own absolute expiry — this hook
 * is a separate, additional layer: it watches for real user activity and
 * forces a logout after `timeoutMinutes` of silence, with a countdown
 * warning starting `warningSeconds` before the cutoff so an active user
 * never gets logged out by surprise mid-task.
 */
export function useIdleTimeout({ timeoutMinutes = 15, warningSeconds = 60, onTimeout, enabled = true }) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(warningSeconds);
  const lastActivityRef = useRef(Date.now());
  const firedRef = useRef(false);

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    firedRef.current = false;
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    stayActive(); // reset the clock whenever this becomes enabled (e.g. on login)

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, stayActive));

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMs = timeoutMs - warningSeconds * 1000;

      if (idleMs >= timeoutMs) {
        if (!firedRef.current) {
          firedRef.current = true;
          setShowWarning(false);
          onTimeout?.();
        }
      } else if (idleMs >= warningMs) {
        setShowWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((timeoutMs - idleMs) / 1000)));
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, stayActive));
      clearInterval(interval);
    };
  }, [enabled, timeoutMinutes, warningSeconds, onTimeout, stayActive]);

  return { showWarning, secondsLeft, stayActive };
}
