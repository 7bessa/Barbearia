const path = require('node:path')
const root = path.resolve(__dirname, '..')

require('./register-typescript.cjs')(root)
require(path.join(root, 'src', 'lib', '__tests__', 'core.test.ts'))
