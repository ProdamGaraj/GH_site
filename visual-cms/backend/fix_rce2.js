const fs = require("fs");
const path = require("path");

// ====== FIX DataTransformService.ts ======
const dtsPath = path.join(__dirname, "src/services/DataTransformService.ts");
let lines = fs.readFileSync(dtsPath, "utf8").split("\n");

// --- Fix 1: Replace lines 268-295 (first executeAsyncComputed with new Function) ---
// Find the method by searching for the unique comment
let fix1Start = -1;
let fix1End = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("executeAsyncComputed") && lines[i].includes("private async") && fix1Start === -1) {
    // Go back to find the JSDoc comment
    let j = i - 1;
    while (j >= 0 && (lines[j].trim().startsWith("*") || lines[j].trim().startsWith("/**") || lines[j].trim() === "")) {
      j--;
    }
    fix1Start = j + 1;
  }
  // Find the closing of this method - look for the matching closing brace
  if (fix1Start !== -1 && fix1End === -1 && i > fix1Start + 5) {
    // The method ends with "  }" at column 2
    if (lines[i].match(/^  \}$/) && lines[i-1] && lines[i-1].includes("throw new Error(`Async compute error")) {
      fix1End = i;
      break;
    }
    if (lines[i].match(/^  \}$/) && i > fix1Start + 20) {
      // Also check if previous lines close the try/catch
      let prevContent = lines.slice(fix1Start, i+1).join("\n");
      if (prevContent.includes("new Function(") && prevContent.includes("Async compute error")) {
        fix1End = i;
        break;
      }
    }
  }
}

console.log("Fix 1: lines", fix1Start, "to", fix1End);

if (fix1Start !== -1 && fix1End !== -1) {
  const replacement1 = [
    "  /**",
    "   * ыполнить async вычисляемое поле (безопасно через vm sandbox)",
    "   */",
    "  private async executeAsyncComputed(",
    "    field: ComputedField,",
    "    context: TransformContext",
    "  ): Promise<unknown> {",
    "    try {",
    "      // спользуем vm sandbox вместо new Function для безопасности",
    "      const sandbox: Record<string, unknown> = {",
    "        value: context.item,",
    "        item: context.item,",
    "        index: context.index,",
    "        items: context.items,",
    "        variables: context.variables || {},",
    "        pageData: context.pageData || {},",
    "        JSON: { parse: JSON.parse, stringify: JSON.stringify },",
    "        String, Number, Boolean, Array, Object, Math, Date,",
    "        parseInt, parseFloat, isNaN, isFinite,",
    "        encodeURIComponent, decodeURIComponent,",
    "        Promise,",
    "        result: undefined,",
    "        __resolve: undefined as unknown,",
    "        __reject: undefined as unknown,",
    "      }",
    "",
    "      const wrappedCode = `",
    "        (async function() {",
    "          const value = item;",
    "          ${field.expression}",
    "        })().then(function(r) { result = r; __resolve(r); }).catch(__reject);",
    "      `",
    "",
    "      const vmContext = vm.createContext(sandbox)",
    "",
    "      return await new Promise((resolve, reject) => {",
    "        sandbox.__resolve = resolve",
    "        sandbox.__reject = reject",
    "        vm.runInContext(wrappedCode, vmContext, {",
    "          timeout: this.sandboxTimeout,",
    "          displayErrors: true,",
    "        })",
    "      })",
    "    } catch (error: any) {",
    "      throw new Error(`Async compute error: ${error.message}`)",
    "    }",
    "  }",
  ];
  
  lines.splice(fix1Start, fix1End - fix1Start + 1, ...replacement1);
  console.log("Fix 1 applied: replaced", fix1End - fix1Start + 1, "lines with", replacement1.length, "lines");
} else {
  console.log("ERROR: Fix 1 pattern not found");
}

// --- Fix 2: Replace second executeComputedFieldAsync with new Function (around line 640) ---
let fix2Start = -1;
let fix2End = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("executeComputedFieldAsync") && lines[i].includes("private async") && fix2Start === -1) {
    let j = i - 1;
    while (j >= 0 && (lines[j].trim().startsWith("*") || lines[j].trim().startsWith("/**") || lines[j].trim() === "")) {
      j--;
    }
    fix2Start = j + 1;
  }
  if (fix2Start !== -1 && fix2End === -1 && i > fix2Start + 5) {
    // This method uses 4-space indent (inner class)
    if (lines[i].match(/^    \}$/) && i > fix2Start + 10) {
      let prevContent = lines.slice(fix2Start, i+1).join("\n");
      if (prevContent.includes("new Function(") && prevContent.includes("executeComputedFieldAsync")) {
        fix2End = i;
        break;
      }
    }
  }
}

console.log("Fix 2: lines", fix2Start, "to", fix2End);

if (fix2Start !== -1 && fix2End !== -1) {
  const replacement2 = [
    "    /**",
    "     * ыполнить async вычисляемое поле (безопасно через vm sandbox)",
    "     */",
    "    private async executeComputedFieldAsync(",
    "      expression: string,",
    "      context: TransformContext",
    "    ): Promise<unknown> {",
    "      // спользуем vm sandbox вместо new Function для безопасности",
    "      const sandbox = this.createSandbox(context)",
    "      Object.assign(sandbox, {",
    "        Promise,",
    "        __resolve: undefined as unknown,",
    "        __reject: undefined as unknown,",
    "        $var: (name: string) => (context.variables || {})[name],",
    "        $data: (alias: string) => (context.dataSources || {})[alias] || [],",
    "        $page: context.pageData || {},",
    "      })",
    "",
    "      const wrappedCode = `",
    "        (async function() {",
    "          const $var = this.$var;",
    "          const $data = this.$data;",
    "          const $page = this.$page;",
    "          ${expression}",
    "        }).call(this).then(function(r) { result = r; __resolve(r); }).catch(__reject);",
    "      `",
    "",
    "      const vmContext = vm.createContext(sandbox)",
    "",
    "      return await new Promise((resolve, reject) => {",
    "        sandbox.__resolve = resolve",
    "        sandbox.__reject = reject",
    "        vm.runInContext(wrappedCode, vmContext, {",
    "          timeout: this.sandboxTimeout,",
    "          displayErrors: true,",
    "        })",
    "      })",
    "    }",
  ];
  
  lines.splice(fix2Start, fix2End - fix2Start + 1, ...replacement2);
  console.log("Fix 2 applied: replaced", fix2End - fix2Start + 1, "lines with", replacement2.length, "lines");
} else {
  console.log("ERROR: Fix 2 pattern not found");
}

fs.writeFileSync(dtsPath, lines.join("\n"), "utf8");
console.log("DataTransformService.ts saved");
