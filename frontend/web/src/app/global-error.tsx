'use client'
export default function GlobalError({
  error, reset,
}: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{
        background: '#050508',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠</div>
          <h2>Application Error</h2>
          <p style={{ color: '#94a3b8', margin: '12px 0' }}>
            {error.message}
          </p>
          <button onClick={reset}
            style={{ 
              background: '#6366f1',
              color: '#fff', 
              padding: '8px 20px',
              borderRadius: 8, 
              border: 'none',
              cursor: 'pointer' 
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
