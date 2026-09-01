/**
 * Inline editing as an HTML overlay (an <input> centred over the element).
 * Commits go through `cmModeling` → command stack (undoable). Double-click any
 * element (context or relationship) to (re)label it; the context pad also
 * routes its rename and owning-team actions through here.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import type { Point } from "diagram-js/lib/util/Types";
import {
  isCmElement,
  isCmRelationship,
  type CmContext,
  type CmElement,
} from "../model/di-types.js";
import type CmModeling from "../modeling/CmModeling.js";

export type EditableProperty = "cmLabel" | "team";

interface ActiveEdit {
  commit: () => void;
  cleanup: () => void;
}

export default class CmLabelEditing {
  static $inject = ["eventBus", "canvas", "cmModeling"];

  private active: ActiveEdit | null = null;

  constructor(
    eventBus: EventBus,
    private readonly canvas: Canvas,
    private readonly modeling: CmModeling,
  ) {
    eventBus.on("element.dblclick", (event: { element?: unknown }) => {
      if (isCmElement(event.element)) this.activate(event.element);
    });
    // Any click/drag/pan outside the input commits (only Escape discards).
    eventBus.on(["element.mousedown", "drag.init", "canvas.viewbox.changing"], () =>
      this.active?.commit(),
    );
  }

  activate(element: CmElement, property: EditableProperty = "cmLabel"): void {
    this.active?.commit();

    const container = this.canvas.getContainer();
    const scale = this.canvas.zoom();
    const vb = this.canvas.viewbox();
    const { x: cx, y: cy } = centreOf(element);
    const width = 170;
    const left = (cx - vb.x) * scale - width / 2;
    const top = (cy - vb.y) * scale - 14;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cm-label-input";
    input.dataset.property = property;
    if (property === "team") input.placeholder = "Owning team";
    const currentValue = (): string =>
      (property === "team" ? (element as CmContext).team : element.cmLabel) ?? "";
    input.value = currentValue();
    input.style.position = "absolute";
    input.style.left = `${left}px`;
    input.style.top = `${top}px`;
    input.style.width = `${width}px`;
    container.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("blur", onBlur);
      input.remove();
      this.active = null;
    };
    const commit = () => {
      if (done) return;
      const value = input.value.trim();
      const changed = value !== currentValue();
      cleanup();
      if (!changed) return;
      if (property === "team") {
        this.modeling.setTeam(element as CmContext, value || undefined);
      } else {
        this.modeling.updateLabel(element, value);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    };
    const onBlur = () => commit();
    input.addEventListener("keydown", onKey);
    input.addEventListener("blur", onBlur);

    this.active = { commit, cleanup };
  }

  cancel(): void {
    this.active?.cleanup();
  }
}

/** The canvas-space centre of a context (box centre) or relationship (mid-waypoint). */
function centreOf(element: CmElement): Point {
  if (isCmRelationship(element)) {
    const wp = (element.waypoints ?? []) as Point[];
    if (wp.length >= 2) {
      const a = wp[0];
      const b = wp[wp.length - 1];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    if (wp.length === 1) return { x: wp[0].x, y: wp[0].y };
    return { x: 0, y: 0 };
  }
  const shape = element as unknown as { x: number; y: number; width: number; height: number };
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}
