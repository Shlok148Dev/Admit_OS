'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function Error({
  error, reset,
}: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[Page Error]', error)
  }, [error])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-6"
    >
      <div style={{ fontSize: 48, marginBottom: 8 }}>⚠</div>
      <h2 style={{
        fontSize: 20, fontWeight: 600,
        color: 'var(--color-text-primary)'
      }}>
        Something went wrong
      </h2>
      <p style={{
        color: 'var(--color-text-secondary)',
        fontSize: 14, textAlign: 'center',
        maxWidth: 400,
      }}>
        {error.message || 'An unexpected error occurred. Our team has been notified.'}
      </p>
      <button
        onClick={reset}
        style={{
          background: 'var(--color-accent-primary)',
          color: '#fff',
          padding: '10px 24px',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Try again
      </button>
    </motion.div>
  )
}
