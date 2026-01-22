import type { ReactNode } from "react";

interface HeaderProps {
  children: ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <box>
      <text>
        <strong fg="gray">{children}</strong>
      </text>
    </box>
  );
}

export default Header;
