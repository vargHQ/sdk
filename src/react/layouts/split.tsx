import type { VargElement } from "../types";
import { Grid } from "./grid";

export const SplitLayout = ({
  left,
  right,
  direction = "horizontal",
}: {
  left: VargElement;
  right: VargElement;
  direction?: "horizontal" | "vertical";
}) => (
  <Grid
    columns={direction === "horizontal" ? 2 : 1}
    rows={direction === "vertical" ? 2 : 1}
  >
    {left}
    {right}
  </Grid>
);

export const Split = ({
  direction = "horizontal",
  children,
}: {
  direction?: "horizontal" | "vertical";
  children: VargElement[];
}) => (
  <Grid
    columns={direction === "horizontal" ? children.length : 1}
    rows={direction === "vertical" ? children.length : 1}
  >
    {children}
  </Grid>
);
