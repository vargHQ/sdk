import type { VargElement } from "./types";

export const Grid = ({
  columns,
  rows,
  children,
}: {
  columns?: number;
  rows?: number;
  children: VargElement[];
}) => {
  const cols = columns ?? children.length;
  const rowCount = rows ?? Math.ceil(children.length / cols);
  const positioned = children.map((el, i) => ({
    ...el,
    props: {
      ...el.props,
      left: (i % cols) / cols,
      top: Math.floor(i / cols) / rowCount,
      width: 1 / cols,
      height: 1 / rowCount,
    },
  }));
  return <>{positioned}</>;
};

export const Split = ({
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
