import type { ProjectFile } from "../../runtime-contract/src/index";

export const bluePlayFrameworkNames = [
  "BluePlayFunctions.kt",
  "World.kt",
  "Actor.kt",
  "Image.kt",
];
export const bluePlayFrameworkFiles: ProjectFile[] = [
  {
    id: "blueplay-framework-BluePlayFunctions.kt",
    fileName: "BluePlayFunctions.kt",
    kind: "functions",
    source: "",
    revision: 1,
  },
  {
    id: "blueplay-framework-World.kt",
    fileName: "World.kt",
    kind: "class",
    source:
      "open class World(val width: Int, val height: Int, val cellSize: Int)",
    revision: 1,
  },
  {
    id: "blueplay-framework-Actor.kt",
    fileName: "Actor.kt",
    kind: "class",
    source: "open class Actor",
    revision: 1,
  },
  {
    id: "blueplay-framework-Image.kt",
    fileName: "Image.kt",
    kind: "class",
    source: "class Image",
    revision: 1,
  },
];
