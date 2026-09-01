/**
 * In-place name editing via diagram-js-direct-editing (the bpmn.io mechanism):
 * double-click a context or relationship — or use the context pad's rename
 * action — and the name becomes editable directly inside the element, at the
 * spot and size it is rendered. Enter/blur commits through
 * `cmModeling.updateLabel` (undoable), Escape cancels; panning/zooming or
 * starting a drag completes the edit. The rendered name is hidden while
 * editing (element marker) so the text never doubles up.
 */

import type Canvas from "diagram-js/lib/core/Canvas";
import type EventBus from "diagram-js/lib/core/EventBus";
import type { Element, ShapeLike } from "diagram-js/lib/model/Types";
import { FONT } from "../draw/styles.js";
import { isCmContext, isCmElement, type CmElement } from "../model/di-types.js";
import type CmModeling from "../modeling/CmModeling.js";

/** Hides the rendered `.cm-name` texts of the element while it is edited. */
const EDITING_MARKER = "cm-direct-editing";

/** Mirrors the renderer: label wrap inset (10px each side), team caption row. */
const LABEL_INSET_X = 10;
const TEAM_RESERVE = 18;

// The service surface of the (untyped, plain-JS) diagram-js-direct-editing
// package — typed locally so nothing untyped leaks into the published d.ts.
interface DirectEditingContext {
  bounds: { x: number; y: number; width: number; height: number };
  text: string;
  style?: Record<string, string | number>;
  options?: { centerVertically?: boolean; autoResize?: boolean; resizable?: boolean };
}

interface DirectEditingService {
  registerProvider(provider: {
    activate(element: Element): DirectEditingContext | undefined;
    update(element: Element, newText: string): void;
  }): void;
  activate(element: Element): boolean;
  isActive(element?: Element): boolean;
  cancel(): void;
  complete(): void;
}

export default class CmLabelEditing {
  static $inject = ["eventBus", "canvas", "directEditing", "cmModeling"];

  constructor(
    eventBus: EventBus,
    private readonly canvas: Canvas,
    private readonly directEditing: DirectEditingService,
    private readonly modeling: CmModeling,
  ) {
    // Registered as a plain object: the provider contract claims the method
    // name `activate` for context creation, while this service keeps
    // `activate(element)` as the public "start editing" API.
    directEditing.registerProvider({
      activate: (element) => this.activationContext(element),
      update: (element, newText) => this.commit(element, newText),
    });

    eventBus.on("element.dblclick", (event: { element?: unknown }) => {
      if (isCmElement(event.element)) directEditing.activate(event.element as Element);
    });

    // The edit box is viewport-anchored — complete before the canvas moves
    // away underneath it (complete() is a no-op while inactive).
    eventBus.on(["canvas.viewbox.changing", "drag.init"], () => directEditing.complete());

    eventBus.on("directEditing.activate", (event: { active?: { element?: Element } }) => {
      const element = event.active?.element;
      if (element) canvas.addMarker(element as unknown as ShapeLike, EDITING_MARKER);
    });
    eventBus.on(
      ["directEditing.complete", "directEditing.cancel"],
      (event: { active?: { element?: Element } }) => {
        const element = event.active?.element;
        if (element) canvas.removeMarker(element as unknown as ShapeLike, EDITING_MARKER);
      },
    );
  }

  /** Start in-place editing of the element's name (context pad, hosts). */
  activate(element: CmElement): void {
    this.directEditing.activate(element as Element);
  }

  cancel(): void {
    this.directEditing.cancel();
  }

  private activationContext(element: Element): DirectEditingContext | undefined {
    if (!isCmElement(element)) return undefined;
    const zoom = this.canvas.zoom();
    const bbox = this.canvas.getAbsoluteBBox(element as unknown as ShapeLike);

    const style: Record<string, string | number> = {
      fontFamily: FONT.family,
      fontSize: `${FONT.label * zoom}px`,
      fontWeight: 650,
      lineHeight: 1.2,
      // In-place illusion: the element's own fill stays visible, a dashed
      // accent frame signals the edit state (the rendered name is hidden).
      backgroundColor: "transparent",
      border: "1px dashed rgba(51, 93, 229, 0.65)",
      textAlign: "center",
    };

    if (isCmContext(element)) {
      // The renderer centres the name over the full height, minus the team
      // caption row — mirror that band so the text does not jump.
      const reserve = element.team ? TEAM_RESERVE * zoom : 0;
      return {
        bounds: {
          x: bbox.x + LABEL_INSET_X * zoom,
          y: bbox.y,
          width: bbox.width - 2 * LABEL_INSET_X * zoom,
          height: bbox.height - reserve,
        },
        text: element.cmLabel ?? "",
        style,
        options: { centerVertically: true },
      };
    }

    // Relationship: a compact box centred on the line (the canvas shows the
    // label only in the hover tooltip, so the box needs its own paper).
    const width = 160 * zoom;
    const height = 44 * zoom;
    return {
      bounds: {
        x: bbox.x + bbox.width / 2 - width / 2,
        y: bbox.y + bbox.height / 2 - height / 2,
        width,
        height,
      },
      text: (element as CmElement).cmLabel ?? "",
      style: { ...style, backgroundColor: "rgba(255, 255, 255, 0.95)" },
      options: { centerVertically: true },
    };
  }

  private commit(element: Element, newText: string): void {
    const value = newText.trim();
    // DirectEditing also calls update() on pure bounds jitter — don't push a
    // no-op command (an empty undo step) when the name did not change.
    if (value === ((element as CmElement).cmLabel ?? "")) return;
    this.modeling.updateLabel(element as CmElement, value);
  }
}
