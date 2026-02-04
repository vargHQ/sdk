/** @jsxImportSource vargai */
import type { VargElement } from "../types";
import { Grid } from "./grid";

export const Split = ({
  direction = "horizontal",
  children,
}: {
  direction?: "horizontal" | "vertical";
  children: VargElement[];
}) => {
  if (children.length === 0) return null;
  return (
    <Grid
      columns={direction === "horizontal" ? children.length : 1}
      rows={direction === "vertical" ? children.length : 1}
    >
      {children}
    </Grid>
  );
};
