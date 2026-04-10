import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#FAF9F6', color: '#0a0a0a', fontFamily: "'DM Sans', sans-serif",
      padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 80, marginBottom: 16, opacity: 0.3 }}>404</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Page introuvable</h1>
      <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 16, marginBottom: 32, maxWidth: 400 }}>
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'linear-gradient(135deg, #C9A84C, #A88A3D)',
          color: '#0a0a0a', border: 'none', padding: '14px 32px',
          borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
        }}
      >
        Retourner à l'accueil →
      </button>
    </div>
  );
}
