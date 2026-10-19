import { afterEach, expect, test } from "vitest";
import {
  Modeler,
  contextMapMenu,
  createShortcutsDialog,
  hoverTipFor,
} from "@miragon/context-maps-renderer";
import { SAMPLE_DOCUMENT } from "@miragon/context-maps-schema-model";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

test("the menu offers the four exports with PNG first and the shortcuts dialog under Help", () => {
  const selected: string[] = [];
  const exportOf = (name: string) => ({ onSelect: () => selected.push(name) });
  const menu = contextMapMenu({
    exports: {
      png: exportOf("png"),
      svg: exportOf("svg"),
      json: exportOf("json"),
      cml: exportOf("cml"),
    },
    showKeyboardShortcuts: () => selected.push("shortcuts"),
  });
  expect(menu.model).toEqual([]);
  expect(menu.export.map((entry) => entry.label)).toEqual([
    "Export as PNG",
    "Export as SVG",
    "Export as JSON",
    "Export as CML",
  ]);
  expect(menu.export.map((entry) => entry.icon)).toEqual([
    "file-image",
    "file-code-corner",
    undefined,
    undefined,
  ]);
  expect(menu.help).toMatchObject([{ kind: "dialog", label: "Keyboard shortcuts…" }]);
  for (const entry of [...menu.export, ...menu.help]) entry.onSelect();
  expect(selected).toEqual(["png", "svg", "json", "cml", "shortcuts"]);
});

test("the shortcuts dialog opens modal in the chrome root and gives the focus back on close", async () => {
  const root = document.createElement("div");
  const trigger = document.createElement("button");
  root.append(trigger);
  document.body.append(root);
  cleanups.push(() => root.remove());
  const dialog = createShortcutsDialog({
    root,
    platform: "other",
    lang: "en",
    menu: { trigger },
    messages: {
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      zoomToActual: (percent) => `Zoom to ${percent}`,
      fit: "Fit to view",
      close: "Close",
      keyNames: { ctrl: "Ctrl", shift: "Shift", plus: "Plus", minus: "Minus" },
    },
  });
  dialog.open();
  const element = root.querySelector<HTMLDialogElement>("dialog.cm-shortcuts")!;
  expect(element.open).toBe(true);
  expect(element.matches(":modal")).toBe(true);
  expect([...element.querySelectorAll("h4")].map((heading) => heading.textContent)).toEqual([
    "View",
    "Edit",
    "Tools",
  ]);
  expect(element.textContent).toContain("Ctrl+Plus");
  expect(element.textContent).toContain("Zoom to 100%");
  element.querySelector<HTMLButtonElement>(".cm-shortcuts-close")!.click();
  expect(dialog.isOpen()).toBe(false);
  // the dialog's close event arrives in a task of its own
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.activeElement).toBe(trigger);
  dialog.destroy();
  expect(root.querySelector("dialog")).toBeNull();
});

test("hovering an element shows its own data in a tooltip inside the canvas", () => {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;left:0;top:0;width:900px;height:640px";
  const container = document.createElement("div");
  wrapper.append(container);
  document.body.append(wrapper);
  const modeler = new Modeler({ container });
  cleanups.push(() => {
    modeler.destroy();
    wrapper.remove();
  });
  modeler.importDocument(SAMPLE_DOCUMENT);
  const registry = modeler.get<{ get(id: string): unknown }>("elementRegistry");
  const eventBus = modeler.get<{ fire(event: string, payload: unknown): void }>("eventBus");

  const tooltip = container.querySelector<HTMLElement>(".djs-container > .cm-hover-tooltip")!;
  expect(tooltip.hidden).toBe(true);
  eventBus.fire("element.hover", {
    element: registry.get("ctx_cfp"),
    originalEvent: new MouseEvent("mouseover", { clientX: 200, clientY: 200 }),
  });
  expect(tooltip.hidden).toBe(false);
  expect(tooltip.textContent).toContain("CfP Management");
  expect(tooltip.textContent).toContain("Team: Program Team");
  eventBus.fire("element.out", { element: registry.get("ctx_cfp") });
  expect(tooltip.hidden).toBe(true);

  expect(hoverTipFor(registry.get("rel_submission_evaluation"))).toEqual({
    title: "Upstream-Downstream · submissions API",
    body: "RESTful HTTP",
  });
});
