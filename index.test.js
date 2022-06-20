import process from 'node:process'
import test from 'ava'
import {useTemporaryDirectory} from 'ava-patterns'
import install from 'quick-install'
import {compose, Logger, startServer, stopServer} from 'passing-notes'
import serveUi from 'passing-notes-ui'
import {closeBrowser, openTab, evalInTab} from 'puppet-strings'
import {openChrome} from 'puppet-strings-chrome'
import {serveRpc, makeRpcClient} from './index.js'

test('calling actions over HTTP', async (t) => {
  const logger = new Logger()
  const logs = []
  logger.on('log', (log) => {
    logs.push(log)
  })

  const server = await startServer(
    {port: 10_000},
    compose(
      serveRpc({
        logger,
        actions: {
          echo(text) {
            return `echo: ${text}`
          },

          error() {
            throw new Error('Something bad happened.')
          },
        },
      }),
      () => () => ({status: 404}),
    ),
  )
  t.teardown(async () => {
    await stopServer(server)
  })

  const client = makeRpcClient('http://localhost:10000')

  t.is(await client.echo('Hello!'), 'echo: Hello!')
  t.like(logs[0], {level: 'INFO', topic: 'RPC', message: 'echo("Hello!")'})
  t.like(logs[1], {
    level: 'INFO',
    topic: 'RPC',
    message: 'echo("Hello!") › Done',
  })

  await t.throwsAsync(client.error(), {message: 'Something bad happened.'})
  t.like(logs[2], {level: 'INFO', topic: 'RPC', message: 'error()'})
  t.like(logs[3], {level: 'ERROR', topic: 'RPC', message: 'error() › Error'})
})

test('calling actions from the browser', async (t) => {
  await install(process.cwd(), process.cwd())

  const directory = await useTemporaryDirectory(t)
  await directory.writeFile(
    'index.html',
    `
    <!doctype html>
    <meta charset="utf-8">
    <script type="module" src="/index.js"></script>
  `,
  )
  await directory.writeFile(
    'index.js',
    `
    import {makeRpcClient} from 'passing-notes-rpc'

    async function run() {
      const client = makeRpcClient()
      document.body.textContent = await client.echo('Hello World!')
    }
    run()
  `,
  )

  const logger = new Logger()
  const server = await startServer(
    {port: 10_001},
    compose(
      serveRpc({
        logger,
        actions: {
          echo(text) {
            return `echo: ${text}`
          },
        },
      }),
      serveUi({path: directory.path, logger}),
      () => () => ({status: 404}),
    ),
  )
  t.teardown(async () => {
    await stopServer(server)
  })

  const browser = await openChrome()
  t.teardown(async () => {
    await closeBrowser(browser)
  })

  const tab = await openTab(browser, 'http://localhost:10001')
  t.is(
    await evalInTab(tab, [], `return document.body.textContent`),
    'echo: Hello World!',
  )
})
