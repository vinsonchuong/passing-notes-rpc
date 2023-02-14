export default function ({logger, actions}) {
  return (next) => async (request) => {
    if (request.method !== 'POST' || request.url !== '/') {
      return next(request)
    }

    const {action, args} = JSON.parse(request.body)

    const finish = logger.measure({
      level: 'INFO',
      topic: 'RPC',
      message: `${action}(${JSON.stringify(args).slice(1, -1)})`,
    })

    try {
      const result = await actions[action](...args)
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
  }
}
