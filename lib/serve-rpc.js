import {ReadableStream, TransformStream} from 'node:stream/web'
import flowRight from 'lodash/flowRight.js'
import * as sse from 'passing-notes-sse'

export default function ({logger, actions}) {
  return flowRight(sse.serialize, (next) => async (request) => {
    if (request.method !== 'POST' || request.url !== '/') {
      return next(request)
    }

    const {action, args} = JSON.parse(request.body)

    const logPrefix = `${action}(${JSON.stringify(args).slice(1, -1)})`
    const finish = logger.measure({
      level: 'INFO',
      topic: 'RPC',
      message: `${logPrefix}`,
    })

    try {
      const result = await actions[action](...args)

      if (result[Symbol.asyncIterator]) {
        return {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
          body: ReadableStream.from(result).pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                logger.log({
                  level: 'INFO',
                  topic: 'RPC',
                  message: `${logPrefix} › Event`,
                })
                controller.enqueue({
                  data: JSON.stringify(chunk),
                })
              },

              flush() {
                finish({
                  level: 'INFO',
                  message: 'Done',
                })
              },
            }),
          ),
        }
      }

      finish({
        level: 'INFO',
        message: 'Done',
      })

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({result}),
      }
    } catch (error) {
      finish({
        level: 'ERROR',
        error,
        message: 'Error',
      })
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({error: error.message}),
      }
    }
  })
}
