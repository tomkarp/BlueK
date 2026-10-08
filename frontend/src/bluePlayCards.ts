import type { ProjectFile } from "../../runtime-contract/src/index";

export const bluePlayLibraryNames = [
  "BluePlayFunctions.kt",
  "World.kt",
  "Actor.kt",
  "Image.kt",
];
export const bluePlayLibraryFiles: ProjectFile[] = [
  {
    id: "blueplay-library-BluePlayFunctions.kt",
    fileName: "BluePlayFunctions.kt",
    kind: "functions",
    source: "",
    revision: 1,
  },
  {
    id: "blueplay-library-World.kt",
    fileName: "World.kt",
    kind: "class",
    source:
      "open class World(val width: Int, val height: Int, val cellSize: Int)",
    revision: 1,
  },
  {
    id: "blueplay-library-Actor.kt",
    fileName: "Actor.kt",
    kind: "class",
    source: "open class Actor",
    revision: 1,
  },
  {
    id: "blueplay-library-Image.kt",
    fileName: "Image.kt",
    kind: "class",
    source: "class Image",
    revision: 1,
  },
];
