const http = require('node:http')
const path = require('node:path')

// Neste computador, o modo de desenvolvimento não consegue criar processos filhos.
// A opção é lida pelo next.config.js antes de o Next ser carregado.
process.env.NEXT_USE_WORKER_THREADS = '1'
process.env.NEXT_DISABLE_WEBPACK_BUILD_WORKER = '1'

const next = require('next')

const host = process.env.HOSTNAME ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 3001)
const app = next({ dev: true, hostname: host, port, dir: path.resolve(__dirname, '..') })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  http.createServer((req, res) => handle(req, res)).listen(port, host, () => {
    console.log(`Preview pronto em http://${host}:${port}`)
  })
}).catch((erro) => {
  console.error(erro)
  process.exit(1)
})
