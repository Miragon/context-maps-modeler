import { describe, expect, it } from "vitest";
import { contentBoundsOf } from "../src/model/contentBounds.js";

function context(id: string, x: number, y: number, width = 200, height = 110) {
  return { id, cmKind: "context", x, y, width, height };
}

function relationship(id: string, waypoints: Array<{ x: number; y: number }>) {
  return { id, cmKind: "relationship", pattern: "partnership", waypoints };
}

describe("contentBoundsOf", () => {
  it("is undefined while there is nothing to draw", () => {
    expect(contentBoundsOf([])).toBeUndefined();
    expect(contentBoundsOf([{ id: "cm-root" }])).toBeUndefined();
    expect(contentBoundsOf([relationship("r", [])])).toBeUndefined();
  });

  it("is the tight box around the contexts, without a margin", () => {
    expect(contentBoundsOf([context("a", -40, 20), context("b", 300, 180, 160, 90)])).toEqual({
      x: -40,
      y: 20,
      width: 500,
      height: 250,
    });
  });

  it("covers every relationship's waypoints, also where they leave the contexts' box", () => {
    const bounds = contentBoundsOf([
      context("a", 0, 0),
      context("b", 400, 0),
      relationship("r", [
        { x: 200, y: 55 },
        { x: 300, y: 260 },
        { x: 400, y: 55 },
      ]),
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 600, height: 260 });
  });

  it("is a box of size zero for a single point, and ignores what has no finite geometry", () => {
    expect(contentBoundsOf([relationship("r", [{ x: 7, y: 9 }])])).toEqual({
      x: 7,
      y: 9,
      width: 0,
      height: 0,
    });
    expect(
      contentBoundsOf([
        context("a", 10, 10),
        context("broken", Number.NaN, 0),
        { id: "shape-of-another-notation", x: -500, y: -500, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 10, y: 10, width: 200, height: 110 });
  });
});
