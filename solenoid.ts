interface SolenoidConfig {
  minTriggerDelayMs: number; // minimum time between triggers to avoid overheating
  maxOpenDurationMs: number; // how long to open the solenoid for, at max strength
  onChange: (open: boolean) => void; // callback for when the solenoid changes state
}

export default ({
  minTriggerDelayMs,
  maxOpenDurationMs,
  onChange,
}: SolenoidConfig) => {
  let lastTrigger = 0;
  let isOpen = false;
  return {
    /**
     * Trigger the solenoid with a given strength. Will be rate-limited by minTriggerDelayMs.
     * @param strength [0, 1] how "hard" to trigger. Mapped to open duration.
     */
    trigger: (strength: number) => {
      if (isOpen || strength <= 0) {
        return;
      }
      const now = Date.now();
      if (now - lastTrigger < minTriggerDelayMs) {
        return;
      }
      const duration = strength * maxOpenDurationMs;
      isOpen = true;
      onChange(true);
      lastTrigger = now;
      setTimeout(() => {
        isOpen = false;
        onChange(false);
      }, duration);
    },
    isOpen: () => isOpen,
  };
};
