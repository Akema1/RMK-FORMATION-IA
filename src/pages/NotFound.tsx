import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0F172A', color: '#fff', fontFamily: "'DM Sans', sans-serif",
      padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 80, marginBottom: 16, opacity: 0.3 }}>404</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Page introuvable</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 32, maxWidth: 400 }}>
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'linear-gradient(135deg, #E8651A, #D4580F)',
          color: '#fff', border: 'none', padding: '14px 32px',
          borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(232,101,26,0.3)',
        }}
      >
        Retourner à l'accueil →
      </button>
    </div>
  );
}
