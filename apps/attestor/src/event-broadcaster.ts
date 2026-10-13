export type SseClient = {
  id: string
  certId: string
  send: (eventType: string, data: unknown) => void
}

export class EventBroadcaster {
  private clients: Map<string, Set<SseClient>> = new Map()

  public subscribe(certId: string, client: SseClient): () => void {
    const key = certId.toLowerCase()
    let set = this.clients.get(key)
    if (!set) {
      set = new Set()
      this.clients.set(key, set)
    }
    set.add(client)

    return () => {
      const currentSet = this.clients.get(key)
      if (currentSet) {
        currentSet.delete(client)
        if (currentSet.size === 0) {
          this.clients.delete(key)
        }
      }
    }
  }

  public broadcastStatus(certId: string, data: unknown): void {
    const key = certId.toLowerCase()
    const set = this.clients.get(key)
    if (set) {
      for (const client of set) {
        client.send('status', data)
      }
    }
  }

  public broadcastHeartbeat(data: unknown): void {
    for (const [, set] of this.clients) {
      for (const client of set) {
        client.send('heartbeat', data)
      }
    }
  }
}
