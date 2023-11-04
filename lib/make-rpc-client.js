import {sendRequest as sendRequestBase, compose, getHeader} from 'passing-notes'
import * as sse from 'passing-notes-sse'

const sendRequest = compose(sse.deserialize, () => sendRequestBase)

export default function (url = document.location.origin) {
  return new Proxy(
    {},
    {
      get(_, action) {
        return async (...args) => {
          const response = await sendRequest({
            method: 'POST',
            url,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({action, args}),
          })

          if (getHeader(response, 'Content-Type') === 'text/event-stream') {
            const stream = response.body.pipeThrough(
              new TransformStream({
                transform(chunk, controller) {
                  controller.enqueue(JSON.parse(chunk.data))
                },
              }),
            )

            return (async function* () {
              const reader = stream.getReader()
              try {
                while (true) {
                  const {done, value} = await reader.read()
                  if (done) {
                    return
                  }

                  yield value
                }
              } finally {
                reader.releaseLock()
              }
            })()
          }

          const data = JSON.parse(response.body)
          if (data.error) {
            throw new Error(data.error)
          }

          return data.result
        }
      },
    },
  )
}
