import type { Diagnostic } from "../../runtime-contract/src/index";

/** Only errors stop a compile; warnings (e.g. an accessor calling itself) are shown alongside a working program. */
export const isCompileError = (diagnostic: Diagnostic) => diagnostic.severity !== "warning";
