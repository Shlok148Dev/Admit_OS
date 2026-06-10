'use client'
import React, { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useTrendStore, Trend } from '@/store/trends'
import toast from 'react-hot-toast'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8000'

export function useRealtimeTrends() {
  const socketRef = useRef<Socket | null>(null)
  const { addTrend, updateTrend } = useTrendStore()

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      // Exponential backoff up to 30s
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.info('[WS] connected')
    })

    socket.on('trend_update', (data: Trend) => {
      addTrend(data)
    })

    socket.on('forecast_update', (data: { trend_id: string; patch: Partial<Trend> }) => {
      updateTrend(data.trend_id, data.patch || {})
    })

    socket.on('anomaly_alert', (data: { trend_id: string; anomaly?: { anomaly_type: string } }) => {
      toast.custom(() => (
        <div style={{
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 10,
          padding: '12px 16px',
          color: '#f8fafc',
          fontSize: 14,
        }}>
          ⚡ Anomaly: {data.anomaly?.anomaly_type || 'Volume Spike'}
          {' on '}
          <strong>{data.trend_id}</strong>
        </div>
      ), { duration: 5000 })
    })

    socket.on('disconnect', () => {
      console.warn('[WS] disconnected')
    })

    return () => {
      socket.disconnect()
    }
  }, [addTrend, updateTrend])

  const subscribe = (trendId: string) => {
    socketRef.current?.emit('subscribe_trend', { trend_id: trendId })
  }

  const unsubscribe = (trendId: string) => {
    socketRef.current?.emit('unsubscribe_trend', { trend_id: trendId })
  }

  return { subscribe, unsubscribe }
}
