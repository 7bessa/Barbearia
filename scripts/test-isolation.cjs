const path = require('node:path')
const dotenv = require('dotenv')

const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL em .env.local antes de testar.')

const principal = new URL(process.env.DATABASE_URL)
const principalDb = decodeURIComponent(principal.pathname.slice(1))
const teste = process.env.DATABASE_URL_TEST
  ? new URL(process.env.DATABASE_URL_TEST)
  : new URL(process.env.DATABASE_URL)

if (!process.env.DATABASE_URL_TEST) {
  teste.pathname = `/${principalDb}_isolation_test`
}

const testeDb = decodeURIComponent(teste.pathname.slice(1))
if (testeDb === principalDb || !/_test$/i.test(testeDb)) {
  throw new Error('O teste exige um banco separado cujo nome termine em _test. O banco principal nunca sera usado.')
}

process.env.DATABASE_URL = teste.toString()
process.env.NODE_ENV = 'test'
process.env.APP_ORIGIN = 'http://localhost:3000'
process.env.TRUST_PROXY = '1'

require('./register-typescript.cjs')(root)
require(path.join(root, 'src', 'lib', '__tests__', 'isolation.test.ts'))
