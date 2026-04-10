export default function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0F172A', color: '#fff', fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: '#E8651A',
        animation: 'spin 0.8s linear infinite',
        marginBottom: 20,
      }} />
      <div style={{
        fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
        letterSpacing: 1, animation: 'pulse-glow 1.5s ease-in-out infinite',
      }}>
        Chargement…
      </div>
    </div>
  );
}
