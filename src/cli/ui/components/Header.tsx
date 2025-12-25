/**
 * Header - Section header component
 * Bold dimmed text for section titles
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface HeaderProps {
  children: ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <Box>
      <Text bold dimColor>
        {children}
      </Text>
    </Box>
  );
}

export default Header;
