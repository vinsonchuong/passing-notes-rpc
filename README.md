# passing-notes-rpc
[![npm](https://img.shields.io/npm/v/passing-notes-rpc.svg)](https://www.npmjs.com/package/passing-notes-rpc)
[![CI Status](https://github.com/vinsonchuong/passing-notes-rpc/workflows/CI/badge.svg)](https://github.com/vinsonchuong/passing-notes-rpc/actions?query=workflow%3ACI)
[![dependencies Status](https://david-dm.org/vinsonchuong/passing-notes-rpc/status.svg)](https://david-dm.org/vinsonchuong/passing-notes-rpc)
[![devDependencies Status](https://david-dm.org/vinsonchuong/passing-notes-rpc/dev-status.svg)](https://david-dm.org/vinsonchuong/passing-notes-rpc?type=dev)

Simple communication between browser and server

## Usage
Install [passing-notes-rpc](https://www.npmjs.com/package/passing-notes-rpc)
by running:

```sh
yarn add passing-notes-rpc
```

Then, compose it with other middleware:

```js
import {compose, Logger} from 'passing-notes'
import {serveRpc} from 'passing-notes-rpc'
import serveUi from 'passing-notes-ui'

const logger = new Logger()

export default compose(
  serveRpc({
    logger,
    actions: {
      echo(text) {
        return `echo: ${text}`
      }

      async *subscribe() {
        yield 'One!'
        yield 'Two!'
        yield 'Three!'
      }
    }
  }),
  serveUi({path: './ui', logger}),
  () => () => ({status: 404})
)
```

These actions can then be called in the browser:

```js
// ui/index.html
<!doctype html>
<meta charset="utf-8">
<script type="module" src="/index.js"></script>
```

```js
// ui/index.js
import {makeRpcClient} from 'passing-notes-rpc'

const client = makeRpcClient()

async function run() {
  console.log(await client.echo('Hello!'))
  // 'echo: Hello!'

  for await (const message of await client.subscribe()) {
    console.log(message)
  }
  // One!
  // Two!
  // Three!
}

run()
```
