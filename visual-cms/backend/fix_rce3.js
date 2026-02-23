const fs = require("fs");
const path = require("path");

const dtsPath = path.join(__dirname, "src/services/DataTransformService.ts");
let lines = fs.readFileSync(dtsPath, "utf8").split("\n");

function findMethodEnd(lines, startLine, indentSpaces) {
  const indent = " ".repeat(indentSpaces);
  let braceCount = 0;
  let started = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") { braceCount++; started = true; }
      if (ch === "}") braceCount--;
    }
    if (started && braceCount === 0) return i;
  }
  return -1;
}

// --- Fix 1: first executeAsyncComputed ---
let fix1MethodLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("private async executeAsyncComputed(") && fix1MethodLine === -1) {
    fix1MethodLine = i;
    break;
  }
}
// Find JSDoc start
let fix1Start = fix1MethodLine;
if (fix1Start > 0) {
  let j = fix1Start - 1;
  while (j >= 0 && (lines[j].trim().startsWith("*") || lines[j].trim().startsWith("/**") || lines[j].trim() === "*/")) j--;
  if (lines[j+1] && lines[j+1].trim().startsWith("/**")) fix1Start = j + 1;
}
let fix1End = findMethodEnd(lines, fix1MethodLine, 2);
console.log("Fix 1: method line", fix1MethodLine, "range", fix1Start, "-", fix1End);
console.log("  Content at end:", JSON.stringify(lines[fix1End]));

if (fix1Start !== -1 && fix1End !== -1) {
  const r1 = [
    "  /**",
    "   * \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C async \u0432\u044B\u0447\u0438\u0441\u043B\u044F\u0435\u043C\u043E\u0435 \u043F\u043E\u043B\u0435 (\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u0447\u0435\u0440\u0435\u0437 vm sandbox)",
    "   */",
    "  private async executeAsyncComputed(",
    "    field: ComputedField,",
    "    context: TransformContext",
    "  ): Promise<unknown> {",
    "    try {",
    "      // \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C vm sandbox \u0432\u043C\u0435\u0441\u0442\u043E new Function \u0434\u043B\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438",
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
    "      const wrappedCode = \\`",
    "        (async function() {",
    "          const value = item;",
    "          \\${field.expression}",
    "        })().then(function(r) { result = r; __resolve(r); }).catch(__reject);",
    "      \\`",
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
    "      throw new Error(\\`Async compute error: \\${error.message}\\`)",
    "    }",
    "  }",
  ];
  lines.splice(fix1Start, fix1End - fix1Start + 1, ...r1);
  console.log("Fix 1 applied");
}

// --- Fix 2: executeComputedFieldAsync ---
let fix2MethodLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("private async executeComputedFieldAsync(") && fix2MethodLine === -1) {
    fix2MethodLine = i;
    break;
  }
}
let fix2Start = fix2MethodLine;
if (fix2Start > 0) {
  let j = fix2Start - 1;
  while (j >= 0 && (lines[j].trim().startsWith("*") || lines[j].trim().startsWith("/**") || lines[j].trim() === "*/")) j--;
  if (lines[j+1] && lines[j+1].trim().startsWith("/**")) fix2Start = j + 1;
}
let fix2End = findMethodEnd(lines, fix2MethodLine, 4);
console.log("Fix 2: method line", fix2MethodLine, "range", fix2Start, "-", fix2End);
if (fix2End !== -1) console.log("  Content at end:", JSON.stringify(lines[fix2End]));

if (fix2Start !== -1 && fix2End !== -1) {
  const r2 = [
    "    /**",
    "     * \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C async \u0432\u044B\u0447\u0438\u0441\u043B\u044F\u0435\u043C\u043E\u0435 \u043F\u043E\u043B\u0435 (\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u0447\u0435\u0440\u0435\u0437 vm sandbox)",
    "     */",
    "    private async executeComputedFieldAsync(",
    "      expression: string,",
    "      context: TransformContext",
    "    ): Promise<unknown> {",
    "      // \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C vm sandbox \u0432\u043C\u0435\u0441\u0442\u043E new Function \u0434\u043B\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438",
    "      const sandbox = this.createSandbox(context)",
    "      Object.assign(sandbox, {",
    "        Promise,",
    "        __resolve: undefined as unknown,",
    "        __reject: undefined as unknown,",
    "        $var: (name: string) => (context.variables || {} as Record<string, unknown>)[name],",
    "        $data: (alias: string) => ((context.dataSources || {}) as Record<string, unknown[]>)[alias] || [],",
    "        $page: context.pageData || {},",
    "      })",
    "",
    "      const wrappedCode = \\`",
    "        (async function() {",
    "          const $var = this.$var;",
    "          const $data = this.$data;",
    "          const $page = this.$page;",
    "          \\${expression}",
    "        }).call(this).then(function(r) { result = r; __resolve(r); }).catch(__reject);",
    "      \\`",
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
  lines.splice(fix2Start, fix2End - fix2Start + 1, ...r2);
  console.log("Fix 2 applied");
}

fs.writeFileSync(dtsPath, lines.join("\n"), "utf8");
console.log("DataTransformService.ts saved");
