import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { WSMessage } from '../types'

const WS_URL =
  import.meta.env.MODE === 'development'
    ? 'ws://localhost:3001/ws'
    : `ws://${window.location.host}/ws`

const RECONNECT_DELAY = 2000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const shouldReconnectRef = useRef(true)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setConnected = useStore((s) => s.setConnected)
  const handleMessage = useStore((s) => s.handleMessage)

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (e) {
        console.error('Failed to parse WebSocket message', e)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (shouldReconnectRef.current) {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error', error)
      ws.close()
    }
  }, [setConnected, handleMessage])

  useEffect(() => {
    shouldReconnectRef.current = true
    connect()
    return () => {
      shouldReconnectRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
