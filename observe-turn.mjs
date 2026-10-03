export const name = 'dsh-observe-turn'

export function apply(ctx) {
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return

    ctx.logger.info(
      `dsh-observe-turn: session=${session.id} turn=${event.data.turn} reason=${event.data.reason.kind}`,
    )
  })
}
