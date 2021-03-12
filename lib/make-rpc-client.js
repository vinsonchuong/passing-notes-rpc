import {sendRequest} from 'passing-notes'

// eslint-disable-next-line no-undef
export default function(url = document.location.origin) {
  return new Proxy(
    {},
    {
      get(_, action) {
        return async (...args) => {
          const response = await sendRequest({
            method: 'POST',
            url,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({action, args})
          })

          const data = JSON.parse(response.body)
          if (data.error) {
            throw new Error(data.error)
          }

          return data.result
        }
      }
    }
  )
}
