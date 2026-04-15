import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { SEMINARS, type Seminar, fmt, PRICE, EARLY_BIRD_PRICE, COACHING_PRICE } from '../data/seminars';
import type { Participant } from '../admin/types';
import { LogoRMK } from '../components/LogoRMK';
import { ChatWidget } from '../components/ChatWidget';

// ── Extracted portal modules ──
import {
  NAVY, GOLD, GOLD_DARK, SURFACE, WHITE, RED, GREEN,
  cardBase, goldButton, navyButton, generateId, getInitials,
} from './portal/tokens';
import type { PortalSection, OnboardingProfile, SurveyAnswer, CommunityPost } from './portal/tokens';
import { SURVEY_QUESTIONS, getRecommendation } from './portal/surveyConfig';
import { FORMATION_CONTENT } from './portal/formationContent';
import PortalSurvey from './portal/PortalSurvey';
import PortalCommunity from './portal/PortalCommunity';
import PortalCoaching from './portal/PortalCoaching';
import PortalProgramme from './portal/PortalProgramme';

// ─────────────────────────────────────────────
// FEATURE FLAGS
// ─────────────────────────────────────────────
// COACHING_ENABLED=false for PR #3: PortalCoaching.tsx calls /api/ai/generate
// with the wrong shape (no templateId, no admin auth) so the AI call ALWAYS
// fails and a hardcoded mock string is shown, misleading paying participants
// into believing they got live AI analysis. The proper fix is a new authed
// /api/ai/coaching endpoint (follow-up PR). Until that ships, hide the tab.
// Also hides the dashboard quick-action and the section render.
const COACHING_ENABLED = false;

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ClientPortal() {
  // ── Auth state ──
  const [email, setEmail] = useState('');
  const [authStep, setAuthStep] = useState<'onboarding' | 'sent' | 'verifying' | 'dashboard'>('onboarding');
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [seminars, setSeminars] = useState<Seminar[]>(SEMINARS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Onboarding state ──
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile>({
    name: '', email: '', company: '', fonction: '',
  });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [wantsCoaching, setWantsCoaching] = useState(false);

  // ── Portal state ──
  const [activeSection, setActiveSection] = useState<PortalSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Survey state ──
  const [surveyStep, setSurveyStep] = useState(0);
  const [surveyStarted, setSurveyStarted] = useState(false);
  const [surveyComplete, setSurveyComplete] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswer>({
    secteur: '', collaborateurs: '', aiUsage: '', defi: '', attentes: [], source: '',
  });
  const [showEncouragement, setShowEncouragement] = useState(false);

  // ── Community state (loaded from Supabase) ──
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    supabase.from('community_posts').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCommunityPosts(data.map(d => ({
            id: d.id,
            author: d.author,
            initials: d.initials,
            date: d.date,
            text: d.text,
            seminarTag: d.seminar_tag,
          })));
        } else {
          // Seed posts if table is empty
          setCommunityPosts([
            { id: '1', author: 'Jean-Baptiste K.', initials: 'JK', date: '2026-04-10', text: "Hate de commencer la formation S1 ! Quelqu'un d'autre du secteur bancaire ?", seminarTag: 'S1' },
            { id: '2', author: 'Mariam T.', initials: 'MT', date: '2026-04-09', text: "J'ai commence a tester ChatGPT pour mes rapports mensuels, les resultats sont impressionnants.", seminarTag: 'S2' },
            { id: '3', author: 'Assane O.', initials: 'AO', date: '2026-04-08', text: "Qui a deja utilise des agents IA dans son entreprise ? J'aimerais echanger sur le sujet.", seminarTag: 'Tous' },
          ]);
        }
      });
  }, []);
  const [newPostText, setNewPostText] = useState('');
  const [communityFilter, setCommunityFilter] = useState('Tous');

  // ── Coaching form state (dashboard quick card) ──
  const [showCoachingForm, setShowCoachingForm] = useState(false);
  const [coachingMessage, setCoachingMessage] = useState('');

  // ── Full coaching section state ──
  const [coachingForm, setCoachingForm] = useState({
    entreprise: '', secteur: '', role: '', defi: '', objectif: 'Intégration IA dans mon activité',
  });
  const [coachingResult, setCoachingResult] = useState('');
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingSubmitted, setCoachingSubmitted] = useState(false);

  // ── Programme accordion state ──
  const [openModule, setOpenModule] = useState<number | null>(null);

  const navigate = useNavigate();

  // ─── Load seminars from DB ───
  useEffect(() => {
    const fetchSeminars = async () => {
      const { data, error: dbErr } = await supabase.from('seminars').select('*');
      if (!dbErr && data && data.length > 0) setSeminars(data);
    };
    fetchSeminars();
  }, []);

  // ─── Listen for magic link callback + existing session ───
  useEffect(() => {
    const handleSession = async (userEmail: string) => {
      setAuthStep('verifying');
      setError('');
      try {
        const { data, error: dbErr } = await supabase
          .from('participants')
          .select('*')
          .eq('email', userEmail.trim().toLowerCase())
          .limit(1)
          .maybeSingle();
        if (dbErr || !data) {
          setError("Aucune inscription trouvee pour cet email. Contactez-nous si vous avez bien une inscription.");
          await supabase.auth.signOut();
          setAuthStep('onboarding');
        } else {
          setParticipant(data);
          setAuthStep('dashboard');
        }
      } catch {
        setError('Erreur lors de la verification. Veuillez reessayer.');
        setAuthStep('onboarding');
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        handleSession(session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email && authStep !== 'dashboard') {
        handleSession(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Send magic link OTP ───
  const sendMagicLink = useCallback(async (targetEmail?: string) => {
    const trimmedEmail = (targetEmail ?? email).trim().toLowerCase();
    if (!trimmedEmail) return;
    setLoading(true);
    setError('');
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      });
      if (otpErr) {
        setError("Impossible d'envoyer le lien. Verifiez votre email et reessayez.");
      } else {
        setAuthStep('sent');
      }
    } catch {
      setError('Erreur reseau. Veuillez reessayer.');
    }
    setLoading(false);
  }, [email]);

  // ─── Sign out ───
  const signOut = async () => {
    await supabase.auth.signOut();
    setParticipant(null);
    setEmail('');
    setAuthStep('onboarding');
    setActiveSection('dashboard');
    setOnboardingStep(0);
  };

  // ─── Export attestation PDF (NAVY / GOLD / IVORY palette) ───
  const exportAttestation = () => {
    if (!participant || participant.status !== 'confirmed') return;
    const s = seminars.find(x => x.id === participant.seminar);
    if (!s) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210, cx = W / 2;

    const navy: [number, number, number] = [27, 42, 74];
    const gold: [number, number, number] = [201, 168, 76];
    const lightGold: [number, number, number] = [230, 210, 150];
    const paleBlue: [number, number, number] = [230, 236, 248];
    const textGray: [number, number, number] = [100, 100, 100];
    const lightGray: [number, number, number] = [180, 180, 180];
    const navyLight: [number, number, number] = [40, 58, 95];

    // Pale blue background (shade of site navy #1B2A4A)
    doc.setFillColor(...paleBlue);
    doc.rect(0, 0, W, H, 'F');

    // Navy top/bottom bands + gold accent lines
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, 5, 'F');
    doc.rect(0, H - 5, W, 5, 'F');
    doc.setFillColor(...gold);
    doc.rect(0, 5, W, 1, 'F');
    doc.rect(0, H - 6, W, 1, 'F');

    // Double border
    doc.setDrawColor(...navyLight);
    doc.setLineWidth(0.4);
    doc.rect(8, 10, W - 16, H - 20);
    doc.setDrawColor(...gold);
    doc.setLineWidth(1.2);
    doc.rect(12, 14, W - 24, H - 28);

    // Gold corner L-brackets
    const cLen = 18, cW = 1.8, ins = 18;
    doc.setLineWidth(cW);
    doc.setDrawColor(...gold);
    doc.line(ins, ins, ins + cLen, ins); doc.line(ins, ins, ins, ins + cLen);
    doc.line(W - ins, ins, W - ins - cLen, ins); doc.line(W - ins, ins, W - ins, ins + cLen);
    doc.line(ins, H - ins, ins + cLen, H - ins); doc.line(ins, H - ins, ins, H - ins - cLen);
    doc.line(W - ins, H - ins, W - ins - cLen, H - ins); doc.line(W - ins, H - ins, W - ins, H - ins - cLen);

    // Diamond ornaments at corners
    const drawDiamond = (dx: number, dy: number, sz: number) => {
      doc.setFillColor(...gold);
      doc.triangle(dx, dy - sz, dx + sz, dy, dx, dy + sz, 'F');
      doc.triangle(dx, dy - sz, dx - sz, dy, dx, dy + sz, 'F');
    };
    drawDiamond(ins, ins, 2); drawDiamond(W - ins, ins, 2);
    drawDiamond(ins, H - ins, 2); drawDiamond(W - ins, H - ins, 2);

    // Triple-line divider helper
    const drawTripleLine = (y: number, mx: number) => {
      doc.setDrawColor(...lightGold); doc.setLineWidth(0.2);
      doc.line(mx, y - 1.5, W - mx, y - 1.5);
      doc.setDrawColor(...gold); doc.setLineWidth(0.7);
      doc.line(mx, y, W - mx, y);
      doc.setDrawColor(...lightGold); doc.setLineWidth(0.2);
      doc.line(mx, y + 1.5, W - mx, y + 1.5);
    };

    // Content
    let curY = 30;

    // Issuing organizations
    doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(...gold);
    doc.text('R M K   C O N S E I L S     \u00D7     C A B E X I A', cx, curY, { align: 'center' });
    curY += 14;

    // Main title
    doc.setFont('times', 'bold'); doc.setFontSize(28); doc.setTextColor(...navy);
    doc.text('ATTESTATION DE FORMATION', cx, curY, { align: 'center' });
    curY += 8;
    drawTripleLine(curY, 60);
    curY += 6;
    drawDiamond(cx, curY, 2.2);
    curY += 10;

    // Certification text
    doc.setFont('times', 'italic'); doc.setFontSize(12); doc.setTextColor(...textGray);
    doc.text('Nous certifions que', cx, curY, { align: 'center' });
    curY += 14;

    // Participant name
    doc.setFont('times', 'bolditalic'); doc.setFontSize(26); doc.setTextColor(...navy);
    const fullName = `${participant.prenom} ${participant.nom}`.toUpperCase();
    doc.text(fullName, cx, curY, { align: 'center' });
    curY += 6;
    const nameW = doc.getTextWidth(fullName);
    doc.setDrawColor(...lightGold); doc.setLineWidth(0.3);
    doc.line(cx - nameW / 2 - 5, curY, cx + nameW / 2 + 5, curY);
    curY += 7;

    // Company + function
    if (participant.societe || participant.fonction) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...textGray);
      doc.text([participant.societe, participant.fonction].filter(Boolean).join('  \u2014  '), cx, curY, { align: 'center' });
      curY += 8;
    }

    doc.setFont('times', 'italic'); doc.setFontSize(12); doc.setTextColor(...textGray);
    doc.text('a suivi avec succ\u00E8s la formation :', cx, curY, { align: 'center' });
    curY += 12;

    // Seminar title
    doc.setFont('times', 'bold'); doc.setFontSize(20); doc.setTextColor(...navy);
    const semTitle = `\u00AB  ${s.title}  \u00BB`;
    doc.text(semTitle, cx, curY, { align: 'center' });
    curY += 3;
    const stW = doc.getTextWidth(semTitle);
    doc.setDrawColor(...gold); doc.setLineWidth(0.6);
    doc.line(cx - stW / 2 + 10, curY, cx + stW / 2 - 10, curY);
    curY += 10;

    // Dates + location
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...textGray);
    doc.text(`${s.week}  \u2014  Abidjan, C\u00F4te d'Ivoire`, cx, curY, { align: 'center' });
    curY += 7;
    doc.setFontSize(10); doc.setTextColor(...lightGray);
    doc.text('Formation hybride : 3 jours pr\u00E9sentiel  +  2 sessions en ligne', cx, curY, { align: 'center' });
    curY += 8;

    drawTripleLine(curY, 50);
    curY += 4;
    drawDiamond(cx, curY, 2.2);
    curY += 10;

    // Signatures
    const sigL = 80, sigR = W - 80, sigHalf = 35;
    doc.setDrawColor(...gold); doc.setLineWidth(0.4);
    doc.line(sigL - sigHalf, curY, sigL + sigHalf, curY);
    doc.line(sigR - sigHalf, curY, sigR + sigHalf, curY);
    curY += 5;
    doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy);
    doc.text('Le Directeur G\u00E9n\u00E9ral', sigL, curY, { align: 'center' });
    doc.text("L'Expert Formateur", sigR, curY, { align: 'center' });
    curY += 5;
    doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(...textGray);
    doc.text('RMK Conseils', sigL, curY, { align: 'center' });
    doc.text('CABEXIA', sigR, curY, { align: 'center' });

    // Footer
    const footY = H - 18;
    doc.setDrawColor(...lightGold); doc.setLineWidth(0.2);
    doc.line(40, footY - 3, W - 40, footY - 3);
    const ref = `ATT-${s.code}-${participant.nom.substring(0, 3).toUpperCase()}${String(Date.now()).slice(-4)}`;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...lightGray);
    doc.text(`R\u00E9f\u00E9rence : ${ref}`, 30, footY);
    doc.text(`D\u00E9livr\u00E9 le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, cx, footY, { align: 'center' });
    doc.setFillColor(...gold);
    drawDiamond(cx, footY + 4, 1.2);

    doc.save(`Attestation_${participant.nom}_${s.code}.pdf`);
  };


  const seminar = participant ? seminars.find(s => s.id === participant.seminar) : null;

  // ═══════════════════════════════════════════
  // ONBOARDING FLOW (replaces direct login)
  // ═══════════════════════════════════════════
  if (authStep === 'onboarding') {
    const totalSteps = 4;
    const containerStyle: React.CSSProperties = {
      minHeight: '100vh', background: SURFACE, color: NAVY,
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    };
    const boxStyle: React.CSSProperties = {
      maxWidth: 560, width: '100%', background: WHITE,
      padding: '48px 40px', borderRadius: 24,
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
    };

    // ── Progress dots ──
    const progressDots = (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 36 }}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} style={{
            width: i === onboardingStep ? 32 : 10, height: 10, borderRadius: 5,
            background: i <= onboardingStep ? GOLD : 'rgba(0,0,0,0.1)',
            transition: 'all 0.4s ease',
          }} />
        ))}
      </div>
    );

    const backBtn = (
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: 'rgba(27,42,74,0.4)',
          fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, margin: '0 auto',
        }}>
          <span>&larr;</span> Retour au site principal
        </button>
      </div>
    );

    // ── STEP 0: Welcome ──
    if (onboardingStep === 0) {
      return (
        <div style={containerStyle}>
          <div style={boxStyle}>
            <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <LogoRMK scale={1.2} variant="light" />
            </div>
            {progressDots}
            <h1 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 16, color: NAVY }}>
              Bienvenue chez RMK Conseils
            </h1>
            <p style={{ textAlign: 'center', color: 'rgba(27,42,74,0.65)', fontSize: 16, lineHeight: 1.7, marginBottom: 12, maxWidth: 420, margin: '0 auto 24px' }}>
              Decouvrez nos formations en Intelligence Artificielle conçues pour les dirigeants et professionnels d'Afrique francophone.
            </p>
            <div style={{
              background: `linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))`,
              border: '1px solid rgba(201,168,76,0.15)', borderRadius: 14,
              padding: 20, marginBottom: 32,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '🎓', label: '4 seminaires specialises' },
                  { icon: '🤝', label: 'Coaching individuel' },
                  { icon: '📍', label: 'Presentiel + en ligne' },
                  { icon: '🏆', label: 'Certification officielle' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, color: 'rgba(27,42,74,0.7)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setOnboardingStep(1)} style={{ ...goldButton(), width: '100%', fontSize: 16, padding: '16px 28px' }}>
              Commencer
            </button>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => {
                setOnboardingStep(3);
              }} style={{
                background: 'none', border: 'none', color: 'rgba(27,42,74,0.45)',
                fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
              }}>
                J'ai deja un compte &mdash; me connecter
              </button>
            </div>
            {backBtn}
          </div>
        </div>
      );
    }

    // ── STEP 1: Quick Profile ──
    if (onboardingStep === 1) {
      const inputStyle: React.CSSProperties = {
        width: '100%', padding: '14px 18px', borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)',
        color: NAVY, fontSize: 15, outline: 'none', transition: 'border-color 0.3s',
        boxSizing: 'border-box',
      };
      const labelStyle: React.CSSProperties = {
        fontSize: 13, fontWeight: 600, color: 'rgba(27,42,74,0.6)',
        marginBottom: 6, display: 'block',
      };

      return (
        <div style={containerStyle}>
          <div style={boxStyle}>
            {progressDots}
            <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: NAVY }}>
              Faisons connaissance
            </h2>
            <p style={{ textAlign: 'center', color: 'rgba(27,42,74,0.55)', fontSize: 14, marginBottom: 28 }}>
              Quelques informations pour personnaliser votre experience.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>Nom complet</label>
                <input
                  value={onboardingProfile.name}
                  onChange={e => setOnboardingProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Kouadio Marie"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = GOLD; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Email professionnel</label>
                <input
                  type="email"
                  value={onboardingProfile.email}
                  onChange={e => {
                    setOnboardingProfile(p => ({ ...p, email: e.target.value }));
                    setEmail(e.target.value);
                  }}
                  placeholder="vous@entreprise.com"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = GOLD; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Entreprise</label>
                  <input
                    value={onboardingProfile.company}
                    onChange={e => setOnboardingProfile(p => ({ ...p, company: e.target.value }))}
                    placeholder="Nom de votre societe"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = GOLD; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fonction</label>
                  <input
                    value={onboardingProfile.fonction}
                    onChange={e => setOnboardingProfile(p => ({ ...p, fonction: e.target.value }))}
                    placeholder="Ex: Directeur General"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = GOLD; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button onClick={() => setOnboardingStep(0)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
                background: 'transparent', color: 'rgba(27,42,74,0.5)', fontSize: 15,
                fontWeight: 600, cursor: 'pointer',
              }}>
                Retour
              </button>
              <button
                onClick={() => setOnboardingStep(2)}
                disabled={!onboardingProfile.name.trim() || !onboardingProfile.email.trim()}
                style={{ ...goldButton(!onboardingProfile.name.trim() || !onboardingProfile.email.trim()), flex: 2 }}
              >
                Continuer
              </button>
            </div>
            {backBtn}
          </div>
        </div>
      );
    }

    // ── STEP 2: Formation Interest ──
    if (onboardingStep === 2) {
      const toggleInterest = (id: string) => {
        setSelectedInterests(prev =>
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
      };

      return (
        <div style={containerStyle}>
          <div style={{ ...boxStyle, maxWidth: 640 }}>
            {progressDots}
            <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: NAVY }}>
              Qu'est-ce qui vous interesse ?
            </h2>
            <p style={{ textAlign: 'center', color: 'rgba(27,42,74,0.55)', fontSize: 14, marginBottom: 28 }}>
              Selectionnez les formations qui correspondent a vos besoins.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {SEMINARS.map(s => {
                const isSelected = selectedInterests.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleInterest(s.id)} style={{
                    padding: '20px 18px', borderRadius: 16, textAlign: 'left',
                    border: isSelected ? `2px solid ${s.color}` : '2px solid rgba(0,0,0,0.08)',
                    background: isSelected ? `${s.color}10` : 'rgba(0,0,0,0.02)',
                    cursor: 'pointer', transition: 'all 0.3s',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {isSelected && (
                      <div style={{
                        position: 'absolute', top: 10, right: 10, width: 22, height: 22,
                        borderRadius: '50%', background: s.color, color: WHITE,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                      }}>
                        &#10003;
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 800, color: s.color, letterSpacing: 1, marginBottom: 6 }}>
                      {s.code}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4, lineHeight: 1.3 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.5)', lineHeight: 1.4 }}>
                      {s.week}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(27,42,74,0.4)', marginTop: 6 }}>
                      {s.target.split(',').slice(0, 2).join(', ')}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Coaching option */}
            <button onClick={() => setWantsCoaching(!wantsCoaching)} style={{
              width: '100%', padding: '18px 20px', borderRadius: 14, textAlign: 'left',
              border: wantsCoaching ? `2px solid ${GOLD}` : '2px solid rgba(0,0,0,0.08)',
              background: wantsCoaching ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.02)',
              cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 28 }}>🎯</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Coaching Personnalise</div>
                <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.5)' }}>
                  Sessions individuelles de 2h &mdash; {fmt(COACHING_PRICE)} FCFA/session
                </div>
              </div>
              {wantsCoaching && (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: GOLD, color: WHITE,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                }}>
                  &#10003;
                </div>
              )}
            </button>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setOnboardingStep(1)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
                background: 'transparent', color: 'rgba(27,42,74,0.5)', fontSize: 15,
                fontWeight: 600, cursor: 'pointer',
              }}>
                Retour
              </button>
              <button onClick={() => setOnboardingStep(3)} style={{ ...goldButton(), flex: 2 }}>
                Continuer
              </button>
            </div>
            {backBtn}
          </div>
        </div>
      );
    }

    // ── STEP 3: Magic Link ──
    if (onboardingStep === 3) {
      const inputEmail = onboardingProfile.email || email;

      return (
        <div style={containerStyle}>
          <div style={boxStyle}>
            {progressDots}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>
                &#9993;
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                Connectez-vous a votre espace
              </h2>
              <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 14, lineHeight: 1.6 }}>
                Nous vous enverrons un lien de connexion securise. Aucun mot de passe requis.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="email"
                value={inputEmail}
                onChange={e => {
                  setEmail(e.target.value);
                  setOnboardingProfile(p => ({ ...p, email: e.target.value }));
                }}
                placeholder="votre.email@entreprise.com"
                style={{
                  width: '100%', padding: '16px 20px', borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)',
                  color: NAVY, fontSize: 16, outline: 'none', transition: 'all 0.3s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = GOLD; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                onKeyDown={e => e.key === 'Enter' && sendMagicLink(inputEmail)}
              />
              <button
                onClick={() => sendMagicLink(inputEmail)}
                disabled={loading || !inputEmail.trim()}
                style={{ ...goldButton(loading || !inputEmail.trim()), width: '100%', fontSize: 16, padding: '16px 28px' }}
              >
                {loading ? 'Envoi en cours...' : 'Recevoir mon lien de connexion'}
              </button>
            </div>
            {error && (
              <div style={{
                color: RED, fontSize: 14, marginTop: 16, textAlign: 'center',
                background: 'rgba(231,76,60,0.05)', padding: 14, borderRadius: 10,
                border: '1px solid rgba(231,76,60,0.1)',
              }}>
                {error}
              </div>
            )}
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(27,42,74,0.35)', marginTop: 20 }}>
              Lien valide 24h &middot; Connexion securisee
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={() => setOnboardingStep(2)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
                background: 'transparent', color: 'rgba(27,42,74,0.5)', fontSize: 15,
                fontWeight: 600, cursor: 'pointer',
              }}>
                Retour
              </button>
            </div>
            {backBtn}
          </div>
        </div>
      );
    }
  }

  // ── Verifying screen ──
  if (authStep === 'verifying') {
    return (
      <div style={{
        minHeight: '100vh', background: SURFACE, color: NAVY,
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          maxWidth: 460, width: '100%', background: WHITE,
          padding: '48px 40px', borderRadius: 24,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.05)', textAlign: 'center',
        }}>
          <LogoRMK scale={1.2} variant="light" />
          <div style={{ marginTop: 32 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(201,168,76,0.3)',
              borderTopColor: GOLD, margin: '0 auto 20px',
              animation: 'spin 1s linear infinite',
            }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Verification en cours...</h2>
            <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 15 }}>Connexion a votre espace en cours.</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Magic link sent screen ──
  if (authStep === 'sent') {
    return (
      <div style={{
        minHeight: '100vh', background: SURFACE, color: NAVY,
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          maxWidth: 460, width: '100%', background: WHITE,
          padding: '48px 40px', borderRadius: 24,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.05)', textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(201,168,76,0.1)', color: GOLD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 24px',
          }}>
            &#9993;
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: NAVY, marginBottom: 16 }}>Verifiez votre email</h2>
          <p style={{ color: 'rgba(27,42,74,0.7)', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
            Un lien de connexion securise a ete envoye a<br />
            <strong style={{ color: GOLD }}>{email || onboardingProfile.email}</strong>
          </p>
          <div style={{
            background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: 12, padding: 20, marginBottom: 28, textAlign: 'left',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(27,42,74,0.7)', margin: 0, lineHeight: 1.8 }}>
              1. Ouvrez l'email recu de <strong>RMK Conseils</strong><br />
              2. Cliquez sur le bouton <strong>&laquo;&nbsp;Se connecter&nbsp;&raquo;</strong><br />
              3. Vous serez redirige automatiquement ici
            </p>
          </div>
          <button onClick={() => { setAuthStep('onboarding'); setOnboardingStep(3); setError(''); }} style={{
            background: 'none', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(27,42,74,0.5)',
            fontSize: 14, cursor: 'pointer', padding: '10px 20px', borderRadius: 10,
          }}>
            &larr; Changer d'email
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // AUTHENTICATED DASHBOARD
  // ═══════════════════════════════════════════
  if (!participant) return null;

  const isDirigeants = seminar?.code === 'S1' || seminar?.id === 's1';
  const sidebarItems: { key: PortalSection; label: string; icon: string; locked?: boolean; tag?: string }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: '◆' },
    { key: 'programme', label: 'Mon Programme', icon: '◉', locked: participant.status !== 'confirmed' },
    ...(COACHING_ENABLED
      ? [{ key: 'coaching' as PortalSection, label: 'Coaching IA', icon: '⭐', locked: participant.status !== 'confirmed', tag: isDirigeants ? 'Inclus' : undefined }]
      : []),
    { key: 'community', label: 'Communaute', icon: '◎' },
    { key: 'discovery', label: 'Decouverte IA', icon: '✦' },
    { key: 'profile', label: 'Mon Profil', icon: '○' },
  ];

  // ── DASHBOARD RENDER ──
  const renderDashboard = () => (
    <div>
      {/* Welcome header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 4 }}>
          Bonjour, {participant.prenom} 👋
        </h1>
        <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15 }}>
          Bienvenue dans votre espace de formation RMK Conseils.
        </p>
      </div>

      {/* Status card */}
      <div style={{ ...cardBase, padding: 28, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(27,42,74,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
              Votre Formation
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 4 }}>
              {seminar?.code} — {seminar?.title ?? 'Formation RMK'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(27,42,74,0.55)', marginBottom: 12 }}>
              {seminar?.week}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: participant.status === 'confirmed' ? 'rgba(39,174,96,0.1)' : 'rgba(243,156,18,0.1)',
              color: participant.status === 'confirmed' ? GREEN : '#F39C12',
              border: `1px solid ${participant.status === 'confirmed' ? 'rgba(39,174,96,0.2)' : 'rgba(243,156,18,0.2)'}`,
            }}>
              {participant.status === 'confirmed' ? '✓ INSCRIPTION VALIDEE' : '⏳ ATTENTE PAIEMENT'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', marginBottom: 4 }}>Investissement</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: NAVY }}>
              {fmt(Number(participant.amount || EARLY_BIRD_PRICE))} <span style={{ fontSize: 13, color: 'rgba(27,42,74,0.35)' }}>FCFA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        {[
          { icon: '◉', label: 'Mon Programme', section: 'programme' as const, locked: participant.status !== 'confirmed' },
          ...(COACHING_ENABLED
            ? [{ icon: '⭐', label: 'Coaching IA', section: 'coaching' as const, locked: participant.status !== 'confirmed' }]
            : []),
          { icon: '◎', label: 'Communaute', section: 'community' as const, locked: false },
          { icon: '✦', label: 'Decouverte IA', section: 'discovery' as const, locked: false },
        ].map(item => (
          <button key={item.section} className="portal-card-3d" onClick={() => !item.locked && setActiveSection(item.section)}
            style={{
              ...cardBase,
              padding: '20px 16px', cursor: item.locked ? 'not-allowed' : 'pointer',
              textAlign: 'center', border: 'none',
              opacity: item.locked ? 0.5 : 1,
            }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{item.label}</div>
            {item.locked && <div style={{ fontSize: 11, color: 'rgba(27,42,74,0.4)', marginTop: 4 }}>🔒 Après confirmation</div>}
          </button>
        ))}
      </div>

      {/* Explorer d'autres formations */}
      {seminars.filter(s => s.id !== participant.seminar).length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
            Explorer d'autres formations
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {seminars.filter(s => s.id !== participant.seminar).map(s => (
              <div key={s.id} className="portal-card-3d" style={{ ...cardBase, padding: 20, borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: 1, marginBottom: 6 }}>{s.code}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 6, lineHeight: 1.4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.5)' }}>{s.week}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coaching CTA */}
      {!isDirigeants && (
        <div style={{ ...cardBase, padding: 28, background: `linear-gradient(135deg, rgba(27,42,74,0.03), rgba(201,168,76,0.05))`, borderLeft: `4px solid ${GOLD}`, marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              &#9733;
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Coaching IA Individuel</div>
              <p style={{ fontSize: 13, color: 'rgba(27,42,74,0.6)', lineHeight: 1.5, margin: 0 }}>
                Sessions privees de 2h avec un expert IA. Travaillez sur vos cas d'usage specifiques.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{fmt(COACHING_PRICE)}</div>
              <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)' }}>FCFA / 2h</div>
            </div>
          </div>
        </div>
      )}

      {/* Attestation */}
      {participant.status === 'confirmed' && (
        <button onClick={exportAttestation} style={{ ...cardBase, padding: 20, cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none', borderTop: `3px solid ${GREEN}`, transition: 'box-shadow 0.2s' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: GREEN, letterSpacing: 1, marginBottom: 6 }}>DOCUMENT OFFICIEL</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Attestation de Formation</div>
          <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', marginTop: 4 }}>Telecharger le PDF certifie</div>
        </button>
      )}
    </div>
  );

  // ── PROFILE RENDER ──
  const renderProfile = () => (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 32 }}>Mon Profil</h1>
      <div style={{ ...cardBase, padding: 32, maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
            color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22,
          }}>
            {participant.prenom[0]}{participant.nom[0]}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>{participant.prenom} {participant.nom}</div>
            <div style={{ fontSize: 14, color: 'rgba(27,42,74,0.5)' }}>{participant.email}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          {[
            { label: 'Societe', value: participant.societe || 'Non renseigne' },
            { label: 'Fonction', value: participant.fonction || 'Non renseigne' },
            { label: 'Telephone', value: participant.tel || 'Non renseigne' },
            { label: 'Formation', value: seminar?.title ?? 'Non renseigne' },
            { label: 'Statut', value: participant.status === 'confirmed' ? 'Inscription validee' : 'En attente de paiement' },
            { label: "Inscrit depuis", value: new Date(participant.created_at).toLocaleDateString('fr-FR') },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: 14, color: 'rgba(27,42,74,0.5)', fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: 14, color: NAVY, fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // PORTAL LAYOUT
  // ═══════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: SURFACE, color: NAVY, fontFamily: "'DM Sans', sans-serif", display: 'flex' }}>
      {/* ─── SIDEBAR (200px) ─── */}
      <aside style={{
        width: 200, background: NAVY,
        display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20,
      }} className="portal-sidebar">
        <div style={{ padding: '0 16px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoRMK scale={0.35} variant="dark" />
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FAF9F6', letterSpacing: 1 }}>RMK</div>
            <div style={{ fontSize: 9, color: GOLD, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Mon Espace</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => setActiveSection(item.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                background: activeSection === item.key ? 'rgba(201,168,76,0.12)' : 'transparent',
                border: 'none',
                borderLeft: activeSection === item.key ? `3px solid ${GOLD}` : '3px solid transparent',
                color: activeSection === item.key ? GOLD : item.locked ? 'rgba(250,249,246,0.3)' : 'rgba(250,249,246,0.55)',
                fontSize: 13, fontWeight: activeSection === item.key ? 700 : 500,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s',
              }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.tag && !item.locked && (
                <span style={{ fontSize: 9, fontWeight: 800, color: GOLD, background: 'rgba(201,168,76,0.15)', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5 }}>
                  {item.tag}
                </span>
              )}
              {item.locked && <span style={{ fontSize: 10, opacity: 0.5 }}>🔒</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding: '0 16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
              color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 12,
            }}>
              {participant.prenom[0]}{participant.nom[0]}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: '#FAF9F6', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {participant.prenom} {participant.nom}
              </div>
            </div>
          </div>
          <button onClick={signOut}
            style={{
              width: '100%', marginTop: 4, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', color: '#FF7675',
              fontSize: 12, cursor: 'pointer', padding: '7px 10px', borderRadius: 8,
              transition: 'all 0.2s',
            }}>
            Deconnexion
          </button>
        </div>
      </aside>

      {/* ─── MOBILE TOP BAR ─── */}
      <div className="portal-mobile-bar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        background: NAVY,
        borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoRMK scale={0.3} variant="dark" forceText={true} />
          <span style={{ color: '#FAF9F6', fontWeight: 700, fontSize: 14 }}>Mon Espace</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
          background: 'none', border: 'none', color: '#FAF9F6', fontSize: 22, cursor: 'pointer',
        }}>
          {mobileMenuOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      {/* ─── MOBILE DROPDOWN MENU ─── */}
      {mobileMenuOpen && (
        <div className="portal-mobile-dropdown" style={{
          display: 'none', position: 'fixed', top: 52, left: 0, right: 0, zIndex: 29,
          background: NAVY, borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 0',
        }}>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => { setActiveSection(item.key); setMobileMenuOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                background: activeSection === item.key ? 'rgba(201,168,76,0.1)' : 'transparent',
                border: 'none',
                color: activeSection === item.key ? GOLD : 'rgba(250,249,246,0.6)',
                fontSize: 15, fontWeight: activeSection === item.key ? 700 : 500,
                cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button onClick={signOut} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
            background: 'transparent', border: 'none', color: '#FF7675',
            fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
          }}>
            Deconnexion
          </button>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main className="portal-main" style={{
        flex: 1, marginLeft: 200, padding: '36px 40px', minHeight: '100vh', overflowY: 'auto',
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>
              {sidebarItems.find(i => i.key === activeSection)?.label}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(27,42,74,0.5)', textAlign: 'right' }}>
              <span style={{ fontWeight: 600, color: NAVY }}>{participant.prenom} {participant.nom}</span>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
              color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13,
            }}>
              {participant.prenom[0]}{participant.nom[0]}
            </div>
          </div>
        </div>

        {/* Sections */}
        {activeSection === 'dashboard' && renderDashboard()}
        {activeSection === 'programme' && <PortalProgramme participant={participant} seminar={seminar} openModule={openModule} setOpenModule={setOpenModule} />}
        {COACHING_ENABLED && activeSection === 'coaching' && <PortalCoaching participant={participant} seminar={seminar} coachingForm={coachingForm} setCoachingForm={setCoachingForm} coachingResult={coachingResult} setCoachingResult={setCoachingResult} coachingLoading={coachingLoading} setCoachingLoading={setCoachingLoading} coachingSubmitted={coachingSubmitted} setCoachingSubmitted={setCoachingSubmitted} />}
        {activeSection === 'community' && <PortalCommunity participant={participant} communityPosts={communityPosts} setCommunityPosts={setCommunityPosts} newPostText={newPostText} setNewPostText={setNewPostText} communityFilter={communityFilter} setCommunityFilter={setCommunityFilter} />}
        {activeSection === 'discovery' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Decouverte IA</h1>
            <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15, marginBottom: 32 }}>
              Identifiez la formation ideale pour vos besoins.
            </p>
            <div style={cardBase}>
              <PortalSurvey surveyStarted={surveyStarted} setSurveyStarted={setSurveyStarted} surveyComplete={surveyComplete} setSurveyComplete={setSurveyComplete} surveyStep={surveyStep} setSurveyStep={setSurveyStep} surveyAnswers={surveyAnswers} setSurveyAnswers={setSurveyAnswers} showEncouragement={showEncouragement} setShowEncouragement={setShowEncouragement} setActiveSection={setActiveSection} />
            </div>
          </div>
        )}
        {activeSection === 'profile' && renderProfile()}
      </main>

      {/* ─── RESPONSIVE CSS ─── */}
      <style>{`
        @media (max-width: 768px) {
          .portal-sidebar { display: none !important; }
          .portal-mobile-bar { display: flex !important; }
          .portal-mobile-dropdown { display: block !important; }
          .portal-main { margin-left: 0 !important; padding: 72px 16px 24px !important; }
        }
        .portal-card-3d { transform-style: preserve-3d; transition: transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s cubic-bezier(0.16,1,0.3,1); }
        .portal-card-3d:hover { transform: perspective(500px) rotateY(4deg) rotateX(-3deg) translateZ(14px) scale(1.03); box-shadow: 0 28px 56px rgba(27,42,74,0.15), 0 12px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(201,168,76,0.2); }
        @media (prefers-reduced-motion: reduce) { .portal-card-3d:hover { transform: none; } }
      `}</style>
      <ChatWidget seminars={seminars} userName={participant?.prenom} />
    </div>
  );
}
