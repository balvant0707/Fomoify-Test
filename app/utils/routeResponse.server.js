export const isRouteResponse = (value) =>
  value instanceof Response ||
  (value &&
    typeof value === "object" &&
    typeof value.status === "number" &&
    value.headers instanceof Headers);
