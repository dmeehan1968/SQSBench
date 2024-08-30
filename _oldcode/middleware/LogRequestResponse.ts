import { MiddlewareObj } from "@middy/core"

const logRequestResponse = (): MiddlewareObj<unknown, void> => {
  return {
    before: ({ event }) => {
      console.log('Before', JSON.stringify({ event }, null, 2))
    },
    after: ({ event, response }) => {
      console.log('After', JSON.stringify({ event, response }, null, 2))
    },
  }
}