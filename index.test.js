import process from 'node:process'
import test from 'ava'
import {useTemporaryDirectory} from 'ava-patterns'
import install from 'quick-install'
import {compose, Logger, startServer, stopServer} from 'passing-notes'
import serveUi from 'passing-notes-ui'
import {closeBrowser, openTab, findElement} from 'puppet-strings'
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

          async *multiple() {
            yield 'One'
            yield {message: 'Two'}
          },

          error() {
            throw new Error('Something bad happened.')
          },
        },
      }),
      () => () => ({status: 404}),
    ),
  )
  t.teardown(() => {
    stopServer(server)
  })

  const client = makeRpcClient('http://localhost:10000')

  t.is(await client.echo('Hello!'), 'echo: Hello!')
  t.like(logs[0], {level: 'INFO', topic: 'RPC', message: 'echo("Hello!")'})
  t.like(logs[1], {
    level: 'INFO',
    topic: 'RPC',
    message: 'echo("Hello!") › Done',
  })

  {
    const iterator = await client.multiple()
    t.deepEqual(await iterator.next(), {value: 'One', done: false})
    t.deepEqual(await iterator.next(), {value: {message: 'Two'}, done: false})
    t.deepEqual(await iterator.next(), {value: undefined, done: true})

    t.like(logs[2], {level: 'INFO', topic: 'RPC', message: 'multiple()'})
    t.like(logs[3], {
      level: 'INFO',
      topic: 'RPC',
      message: 'multiple() › Event',
    })
    t.like(logs[4], {
      level: 'INFO',
      topic: 'RPC',
      message: 'multiple() › Event',
    })
    t.like(logs[5], {
      level: 'INFO',
      topic: 'RPC',
      message: 'multiple() › Done',
    })
  }

  await t.throwsAsync(client.error(), {message: 'Something bad happened.'})
  t.like(logs[6], {level: 'INFO', topic: 'RPC', message: 'error()'})
  t.like(logs[7], {level: 'ERROR', topic: 'RPC', message: 'error() › Error'})
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

      {
        const div = document.createElement('div')
        div.textContent = await client.echo('Hello World!')
        document.body.append(div)
      }

      for await (const item of await client.multiple()) {
        const div = document.createElement('div')
        div.textContent = item
        document.body.append(div)
      }
    }
    run()
  `,
  )

  const logger = new Logger()
  logger.on('log', (event) => {
    t.log(event)
  })

  const server = await startServer(
    {port: 10_001},
    compose(
      serveRpc({
        logger,
        actions: {
          echo(text) {
            return `echo: ${text}`
          },
          async *multiple() {
            yield 'One'
            yield 'Two'
          },
        },
      }),
      serveUi({path: directory.path, logger}),
      () => () => ({status: 404}),
    ),
  )
  t.teardown(() => {
    stopServer(server)
  })

  const browser = await openChrome()
  t.teardown(() => {
    closeBrowser(browser)
  })

  const tab = await openTab(browser, 'http://localhost:10001', {
    waitUntilNetworkIdle: true,
  })

  await findElement(tab, 'div', 'echo: Hello World!')
  await findElement(tab, 'div', 'One')
  await findElement(tab, 'div', 'Two')

  t.pass()
})
