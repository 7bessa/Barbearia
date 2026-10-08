const path = require('node:path')
const Module = require('node:module')
const ts = require(path.join(path.resolve(__dirname, '..'), 'node_modules', 'typescript'))

module.exports = function registrarTypeScript(root) {
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request.startsWith('@/')) request = path.join(root, 'src', request.slice(2))
    return originalResolve.call(this, request, parent, isMain, options)
  }

  require.extensions['.ts'] = (mod, filename) => {
    const source = require('node:fs').readFileSync(filename, 'utf8')
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    })
    mod._compile(result.outputText, filename)
  }
}
