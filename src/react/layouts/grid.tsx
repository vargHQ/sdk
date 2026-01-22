import type { VargElement } from "../types";

export const Grid = ({
  columns,
  rows,
  children,
  resize = "contain",
}: {
  columns?: number;
  rows?: number;
  children: VargElement[];
  resize?: "cover" | "contain" | "stretch";
}) => {
  const cols = columns ?? children.length;
  const rowCount = rows ?? Math.ceil(children.length / cols);
  const positioned = children.map((el, i) => ({
    ...el,
    props: {
      ...el.props,
      left: `${((i % cols) / cols) * 100}%`,
      top: `${(Math.floor(i / cols) / rowCount) * 100}%`,
      width: `${(1 / cols) * 100}%`,
      height: `${(1 / rowCount) * 100}%`,
      resize,
    },
  }));
  return <>{positioned}</>;
};
