import type { Relationship } from "@miragon/context-maps-schema-model";

/** ID of the diagram-js root element holding the Context Maps diagram. */
export const ROOT_ID = "cm-root";

/** Ids diagram-js gives its own root elements; a document element must not take them. */
export function isReservedId(id: string): boolean {
  return id === ROOT_ID || id.startsWith("__implicitroot");
}

export interface ImportWarning {
  readonly message: string;
  readonly elementId?: string;
}

/** Diagram-level data stashed on the root element. */
export interface RootBusinessObject {
  title: string;
  /** Keys of the document this version does not know, written back on export. */
  foreign?: Record<string, unknown>;
  /**
   * Relationships whose ends are not both contexts of the map. The canvas cannot draw them, but
   * they stay in the document (and in the Problems view) until the text fixes them.
   */
  unplacedRelationships?: Relationship[];
}
