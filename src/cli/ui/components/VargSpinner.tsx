/** @jsxImportSource react */
/**
 * VargSpinner - Animated loading indicator
 * Elegant braille spinner with label
 */

import { Text } from "ink";
import { useEffect, useState } from "react";
import { theme } from "../theme.ts";

interface VargSpinnerProps {
  label?: string;
}

export function VargSpinner({ label }: VargSpinnerProps) {
  const [frame, setFrame] = useState(0);
  const frames = theme.animation.spinnerFrames;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, theme.animation.spinnerInterval);

    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Text>
      <Text color={theme.colors.accent}>{frames[frame]}</Text>
      {label && <Text> {label}</Text>}
    </Text>
  );
}

export default VargSpinner;
