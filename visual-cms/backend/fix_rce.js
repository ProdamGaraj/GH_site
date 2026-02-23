const fs = require('fs');
const path = require('path');

const dtsPath = path.join(__dirname, 'src/services/DataTransformService.ts');
let dts = fs.readFileSync(dtsPath, 'utf8');

// Find and replace the FIRST executeAsyncComputed method that uses new Function
// We search for the specific pattern with "new Function("
const pattern1Start = '  private async executeAsyncComputed(\n    field: ComputedField,\n    context: TransformContext\n  ): Promise<unknown> {\n    // \u0414\u043B\u044F async \u043F\u043E\u043B\u0435\u0439 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C \u043E\u0431\u044B\u0447\u043D\u044B\u0439 eval \u0441 Promise';
const pattern1Regex = /  private async executeAsyncComputed\(\n    field: ComputedField,\n    context: TransformContext\n  \): Promise<unknown> \{\n    \/\/ .*?eval.*?Promise\n.*?try \{[\s\S]*?const asyncFunction = new Function\([\s\S]*?\} catch \(error: any\) \{\n      throw new Error\(`Async compute error: \$\{error\.message\}`\)\n    \}\n  \}/;

const match1 = dts.match(pattern1Regex);
if (match1) {
  console.log('Found first pattern at index', match1.index, 'length', match1[0].length);
  
  const replacement1 = `  /**
   * \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C async \u0432\u044B\u0447\u0438\u0441\u043B\u044F\u0435\u043C\u043E\u0435 \u043F\u043E\u043B\u0435 (\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u0447\u0435\u0440\u0435\u0437 vm sandbox)
   */
  private async executeAsyncComputed(
    field: ComputedField,
    context: TransformContext
  ): Promise<unknown> {
    try {
      // \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C vm sandbox \u0432\u043C\u0435\u0441\u0442\u043E new Function \u0434\u043B\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438
      const sandbox: Record<string, unknown> = {
        value: context.item,
        item: context.item,
        index: context.index,
        items: context.items,
        variables: context.variables || {},
        pageData: context.pageData || {},
        JSON: { parse: JSON.parse, stringify: JSON.stringify },
        String, Number, Boolean, Array, Object, Math, Date,
        parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent,
        Promise,
        result: undefined,
        __resolve: undefined as unknown,
        __reject: undefined as unknown,
      }

      const wrappedCode = \`
        (async function() {
          const value = item;
          \${field.expression}
        })().then(function(r) { result = r; __resolve(r); }).catch(__reject);
      \`

      const vmContext = vm.createContext(sandbox)

      return await new Promise((resolve, reject) => {
        sandbox.__resolve = resolve
        sandbox.__reject = reject
        vm.runInContext(wrappedCode, vmContext, {
          timeout: this.sandboxTimeout,
          displayErrors: true,
        })
      })
    } catch (error: any) {
      throw new Error(\`Async compute error: \${error.message}\`)
    }
  }`;
  
  dts = dts.substring(0, match1.index) + replacement1 + dts.substring(match1.index + match1[0].length);
  console.log('Fix 1 applied');
} else {
  console.log('ERROR: Pattern 1 not found');
}

fs.writeFileSync(dtsPath, dts, 'utf8');
console.log('Saved');