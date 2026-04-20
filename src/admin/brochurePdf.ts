/**
 * PDF generation logic for the RMK x CABEXIA marketing brochure.
 * Improved structure: 6 pages with certification cover, "Ce que vous vivrez" pillars,
 * day-by-day program, seminar grid, formateur bio, and pricing.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SEMINARS, PRICE, EARLY_BIRD_PRICE, COACHING_PRICE, fmt } from '../data/seminars';
import type { Seminar as BaseSeminar } from '../data/seminars';

// ---- Color constants ----
const NAVY = '#1B2A4A';
const GOLD = '#C9A84C';

// ---- Hex to RGB helper ----
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ---- Page dimensions (A4 portrait in mm) ----
const PW = 210;
const PH = 297;
const MARGIN = 20;

// ---- Shared helpers ----

function drawHeaderBar(doc: jsPDF, pageNum: number, totalPages: number): void {
  const [nr, ng, nb] = hexToRgb(NAVY);
  doc.setFillColor(nr, ng, nb);
  doc.rect(0, 0, PW, 14, 'F');
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  const [gr, gg, gb] = hexToRgb(GOLD);
  doc.setTextColor(gr, gg, gb);
  doc.text('RMK CONSEILS  x  CABEXIA', MARGIN, 9);
  doc.text(`${pageNum} / ${totalPages}`, PW - MARGIN, 9, { align: 'right' });
}

function drawGoldLine(doc: jsPDF, y: number, x1: number, x2: number, thickness = 0.5): void {
  const [r, g, b] = hexToRgb(GOLD);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(thickness);
  doc.line(x1, y, x2, y);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  const [nr, ng, nb] = hexToRgb(NAVY);
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(nr, ng, nb);
  doc.text(title, MARGIN, y);
  drawGoldLine(doc, y + 3, MARGIN, MARGIN + 60, 0.8);
  return y + 14;
}

function drawFooterBar(doc: jsPDF): void {
  const [gr, gg, gb] = hexToRgb(GOLD);
  doc.setFillColor(gr, gg, gb);
  doc.rect(0, PH - 14, PW, 14, 'F');
  const [nr, ng, nb] = hexToRgb(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(nr, ng, nb);
  doc.text('contact@rmkconsulting.pro  |  +225 07 02 61 15 82  |  rmkconsulting.pro', PW / 2, PH - 6, { align: 'center' });
}

// ---- Page 1: Cover ----

function buildCoverPage(doc: jsPDF): void {
  const [nr, ng, nb] = hexToRgb(NAVY);
  const [gr, gg, gb] = hexToRgb(GOLD);

  // Full navy background
  doc.setFillColor(nr, ng, nb);
  doc.rect(0, 0, PW, PH, 'F');

  // Gold accent band at top
  doc.setFillColor(gr, gg, gb);
  doc.rect(0, 0, PW, 8, 'F');

  // Partner line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(gr, gg, gb);
  doc.setCharSpace(2);
  doc.text('RMK CONSEILS  ×  CABEXIA', PW / 2, 22, { align: 'center' });
  doc.setCharSpace(0);

  // Thin separator
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.3);
  doc.line(PW / 2 - 35, 27, PW / 2 + 35, 27);

  // Certification badge
  doc.setFillColor(gr, gg, gb);
  doc.roundedRect(PW / 2 - 48, 32, 96, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(nr, ng, nb);
  doc.text('CERTIFICATION INTERNATIONALE EN IA', PW / 2, 38.5, { align: 'center' });

  // Main title
  doc.setFont('times', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  doc.text('FORMATIONS EN', PW / 2, 70, { align: 'center' });
  doc.setTextColor(gr, gg, gb);
  doc.text('INTELLIGENCE', PW / 2, 83, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.text('ARTIFICIELLE', PW / 2, 96, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(200, 210, 225);
  doc.text('Transformez votre pratique professionnelle', PW / 2, 110, { align: 'center' });
  doc.text('grace a l\'IA generative', PW / 2, 117, { align: 'center' });

  // Gold divider
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.8);
  doc.line(MARGIN + 10, 127, PW - MARGIN - 10, 127);

  // 4 seminars in pill-style cards
  const seminars = [
    { code: 'S1', title: 'IA Strategique Dirigeants', color: '#2980B9', week: '26 – 30 Mai 2026' },
    { code: 'S2', title: 'IA appliquee a la Finance', color: '#2980B9', week: '2 – 6 Juin 2026' },
    { code: 'S3', title: 'IA pour les Notaires', color: '#2980B9', week: '9 – 13 Juin 2026' },
    { code: 'S4', title: 'IA pour les Ressources Humaines', color: '#2980B9', week: '16 – 20 Juin 2026' },
  ];

  let sy = 137;
  for (const s of seminars) {
    const [cr, cg, cb] = hexToRgb(s.color);
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(MARGIN, sy, 6, 14, 1, 1, 'F');
    doc.setFillColor(30, 45, 75);
    doc.roundedRect(MARGIN + 6, sy, PW - 2 * MARGIN - 6, 14, 0, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(gr, gg, gb);
    doc.text(s.code, MARGIN + 12, sy + 9);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(s.title, MARGIN + 22, sy + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 180, 210);
    doc.text(s.week, MARGIN + 22, sy + 11);
    sy += 17;
  }

  // Format highlight
  doc.setFillColor(gr, gg, gb);
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, sy + 8, PW - 2 * MARGIN, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(nr, ng, nb);
  doc.text('Format Hybride  ·  3 jours Presentiel  +  2 jours En Ligne', PW / 2, sy + 15.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Abidjan, Cote d\'Ivoire  —  Mai / Juin 2026  —  20 participants max par atelier', PW / 2, sy + 21.5, { align: 'center' });

  sy += 36;

  // Partner logos as text blocks
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 140, 165);
  doc.text('PARTENAIRES', PW / 2, sy + 6, { align: 'center' });
  doc.setDrawColor(80, 100, 130);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 10, sy + 8, PW - MARGIN - 10, sy + 8);

  const partners = ['CABEXIA', 'RMK CONSEILS'];
  const colW = (PW - 2 * MARGIN) / partners.length;
  for (let i = 0; i < partners.length; i++) {
    const px = MARGIN + i * colW + colW / 2;
    doc.setFillColor(25, 40, 70);
    doc.roundedRect(MARGIN + i * colW + 4, sy + 11, colW - 8, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(gr, gg, gb);
    doc.text(partners[i], px, sy + 19.5, { align: 'center' });
  }

  // Gold footer
  doc.setFillColor(gr, gg, gb);
  doc.rect(0, PH - 12, PW, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(nr, ng, nb);
  doc.text('contact@rmkconsulting.pro  |  +225 07 02 61 15 82  |  rmkconsulting.pro', PW / 2, PH - 4.5, { align: 'center' });
}

// ---- Page 2: Ce que vous vivrez (5 piliers) ----

function buildPillarsPage(doc: jsPDF): void {
  const [nr, ng, nb] = hexToRgb(NAVY);
  const [gr, gg, gb] = hexToRgb(GOLD);

  drawHeaderBar(doc, 2, 6);

  let y = 28;
  y = drawSectionTitle(doc, 'Ce que vous vivrez', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 90, 105);
  doc.text(
    'Un programme intensif de 5 jours concu pour transformer votre rapport a l\'intelligence artificielle.',
    MARGIN, y,
    { maxWidth: PW - 2 * MARGIN }
  );
  y += 12;

  // Module commun highlight
  doc.setFillColor(gr, gg, gb);
  doc.roundedRect(MARGIN, y, PW - 2 * MARGIN, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(nr, ng, nb);
  doc.text('MODULE COMMUN — Matin du Jour 1', MARGIN + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Introduction generale a l\'IA generative — partagee entre toutes les formations', MARGIN + 6, y + 13);
  y += 24;

  // 5 pillars
  const pillars = [
    {
      num: '01',
      icon: '◉',
      title: 'Ateliers Academiques Intensifs',
      desc: '3 jours de sessions presentielles encadrees par des experts certifies CABEXIA avec pedagogie active et mises en situation reelles.',
    },
    {
      num: '02',
      icon: '◎',
      title: 'Immersions Pratiques',
      desc: 'Ateliers de cas concrets adaptes a votre metier : analyse de donnees, creation d\'agents IA, automatisation de workflows professionnels.',
    },
    {
      num: '03',
      icon: '⊕',
      title: 'Networking & Echanges',
      desc: 'Rencontres avec des decideurs de votre secteur. Partages d\'experiences et construction d\'un reseau professionnel actif en IA.',
    },
    {
      num: '04',
      icon: '✦',
      title: 'Sessions en Ligne (J4–J5)',
      desc: '2 jours de sessions virtuelles pour ancrer les apprentissages, presenter vos projets et recevoir un feedback personnalise du formateur.',
    },
    {
      num: '05',
      icon: '★',
      title: 'Attestation & Certification',
      desc: 'Attestation officielle de formation delivree par RMK Conseils x CABEXIA, reconnue par les entreprises partenaires en Afrique de l\'Ouest.',
    },
  ];

  const cardH = 36;
  const cardGap = 6;

  for (const p of pillars) {
    // Card background
    doc.setFillColor(248, 249, 252);
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, y, PW - 2 * MARGIN, cardH, 2, 2, 'FD');

    // Gold left accent
    doc.setFillColor(gr, gg, gb);
    doc.roundedRect(MARGIN, y, 3, cardH, 1, 1, 'F');

    // Number badge
    doc.setFillColor(nr, ng, nb);
    doc.circle(MARGIN + 14, y + 11, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(gr, gg, gb);
    doc.text(p.num, MARGIN + 14, y + 13.5, { align: 'center' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(nr, ng, nb);
    doc.text(p.title, MARGIN + 26, y + 10);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 85, 105);
    const descLines = doc.splitTextToSize(p.desc, PW - 2 * MARGIN - 26);
    doc.text(descLines, MARGIN + 26, y + 18);

    y += cardH + cardGap;
  }

  drawFooterBar(doc);
}

// ---- Page 3: Programme Jour par Jour ----

function buildProgrammePage(doc: jsPDF): void {
  const [nr, ng, nb] = hexToRgb(NAVY);
  const [gr, gg, gb] = hexToRgb(GOLD);

  drawHeaderBar(doc, 3, 6);

  let y = 28;
  y = drawSectionTitle(doc, 'Programme Jour par Jour', y);

  const days = [
    {
      day: 'JOUR 1',
      label: 'Mardi',
      type: 'Presentiel',
      color: NAVY,
      sessions: [
        { time: '09:00 – 12:00', label: 'MATIN', content: 'Module Commun — Introduction IA Generative (tous ateliers)', highlight: true },
        { time: '13:30 – 17:30', label: 'APRES-MIDI', content: 'Approfondissement par seminar : fondations metier + cadre theorique specifique', highlight: false },
      ],
    },
    {
      day: 'JOUR 2',
      label: 'Mercredi',
      type: 'Presentiel',
      color: NAVY,
      sessions: [
        { time: '09:00 – 12:30', label: 'MATIN', content: 'Prompt Engineering avance — cas pratiques par metier avec exercices sur outils IA', highlight: false },
        { time: '13:30 – 17:30', label: 'APRES-MIDI', content: 'Atelier Immersion : creation d\'agents, automatisation, analyse de documents avec IA', highlight: false },
      ],
    },
    {
      day: 'JOUR 3',
      label: 'Jeudi',
      type: 'Presentiel',
      color: NAVY,
      sessions: [
        { time: '09:00 – 12:30', label: 'MATIN', content: 'Applications avancees : connecteurs MCP, Claude Projects, outils IA metier specifiques', highlight: false },
        { time: '13:30 – 17:00', label: 'APRES-MIDI', content: 'Presentation des projets individuels, feedback expert, plan d\'action personnel IA', highlight: false },
      ],
    },
    {
      day: 'JOUR 4',
      label: 'Vendredi',
      type: 'En Ligne',
      color: '#2980B9',
      sessions: [
        { time: '09:00 – 12:00', label: 'SESSION VIRTUELLE', content: 'Consolidation des apprentissages — Q&A collectif avec le formateur', highlight: false },
        { time: '14:00 – 16:00', label: 'COACHING', content: 'Suivi de l\'avancement du projet personnel IA — retours individualises', highlight: false },
      ],
    },
    {
      day: 'JOUR 5',
      label: 'Samedi',
      type: 'En Ligne',
      color: '#2980B9',
      sessions: [
        { time: '09:00 – 11:00', label: 'SESSION FINALE', content: 'Presentations finales par groupe — evaluation des projets et livrables IA', highlight: false },
        { time: '11:00 – 12:00', label: 'CLOTURE', content: 'Remise des attestations, ouverture sur le reseau alumni RMK x CABEXIA', highlight: true },
      ],
    },
  ];

  const rowH = 44;
  const rowGap = 4;

  for (const d of days) {
    const [cr, cg, cb] = hexToRgb(d.color);

    // Day header
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(MARGIN, y, 28, rowH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(gr, gg, gb);
    doc.text(d.day, MARGIN + 14, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 215, 235);
    doc.text(d.label, MARGIN + 14, y + 17, { align: 'center' });

    // Type badge
    doc.setFillColor(d.type === 'En Ligne' ? 41 : gr, d.type === 'En Ligne' ? 128 : gg, d.type === 'En Ligne' ? 185 : gb);
    doc.roundedRect(MARGIN + 30, y, 26, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(d.type.toUpperCase(), MARGIN + 43, y + 5, { align: 'center' });

    // Sessions
    let sy = y + 9;
    for (const s of d.sessions) {
      if (s.highlight) {
        doc.setFillColor(gr, gg, gb);
        doc.roundedRect(MARGIN + 30, sy - 2, PW - 2 * MARGIN - 30, 14, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(nr, ng, nb);
      } else {
        doc.setFillColor(245, 247, 251);
        doc.roundedRect(MARGIN + 30, sy - 2, PW - 2 * MARGIN - 30, 14, 1, 1, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(nr, ng, nb);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(s.highlight ? nr : 130, s.highlight ? ng : 145, s.highlight ? nb : 165);
      doc.text(`${s.time}  ${s.label}`, MARGIN + 32, sy + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(s.highlight ? nr : nr, s.highlight ? ng : ng, s.highlight ? nb : nb);
      const contentLines = doc.splitTextToSize(s.content, PW - 2 * MARGIN - 36);
      doc.text(contentLines[0] || '', MARGIN + 32, sy + 8);
      sy += 16;
    }

    y += rowH + rowGap;
  }

  drawFooterBar(doc);
}

// ---- Page 4: Nos Formations ----

function buildSeminarsPage(doc: jsPDF, selectedSeminars: BaseSeminar[]): void {
  const [nr, ng, nb] = hexToRgb(NAVY);

  drawHeaderBar(doc, 4, 6);

  let y = 28;
  y = drawSectionTitle(doc, 'Nos Formations', y);

  const cardW = (PW - 2 * MARGIN - 8) / 2;
  const cardH = 105;

  selectedSeminars.forEach((sem, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = MARGIN + col * (cardW + 8);
    const cy = y + row * (cardH + 8);

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'S');

    const [cr, cg, cb] = hexToRgb(sem.color);
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(cx, cy, cardW, 14, 2, 2, 'F');
    doc.rect(cx, cy + 10, cardW, 4, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`${sem.code} — ${sem.title}`, cx + 4, cy + 10);

    let innerY = cy + 20;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(nr, ng, nb);
    doc.text(sem.subtitle, cx + 4, innerY);
    innerY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cr, cg, cb);
    doc.text(sem.week, cx + 4, innerY);
    innerY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(nr, ng, nb);
    const highlights = sem.highlights.slice(0, 4);
    for (const hl of highlights) {
      const truncated = hl.length > 55 ? hl.substring(0, 52) + '...' : hl;
      doc.text(`  – ${truncated}`, cx + 4, innerY);
      innerY += 4.5;
    }

    innerY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const targetText = `Public : ${sem.target}`;
    const targetLines = doc.splitTextToSize(targetText, cardW - 8);
    doc.text(targetLines.slice(0, 2), cx + 4, innerY);
  });

  drawFooterBar(doc);
}

// ---- Page 5: Votre Formateur ----

function buildFormateurPage(doc: jsPDF): void {
  const [nr, ng, nb] = hexToRgb(NAVY);
  const [gr, gg, gb] = hexToRgb(GOLD);

  drawHeaderBar(doc, 5, 6);

  let y = 28;
  y = drawSectionTitle(doc, 'Votre Formateur', y);

  // Profile card
  doc.setFillColor(nr, ng, nb);
  doc.roundedRect(MARGIN, y, PW - 2 * MARGIN, 50, 3, 3, 'F');

  // Avatar circle
  doc.setFillColor(gr, gg, gb);
  doc.circle(MARGIN + 22, y + 25, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(nr, ng, nb);
  doc.text('DM', MARGIN + 22, y + 28, { align: 'center' });

  // Name and title
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('Djimtahadoum Memtingar', MARGIN + 46, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(gr, gg, gb);
  doc.text('Expert-Consultant & Formateur en IA Generative', MARGIN + 46, y + 24);
  doc.setFontSize(8);
  doc.setTextColor(160, 180, 210);
  doc.text('CABEXIA — Cabinet d\'Expertise en Intelligence Artificielle', MARGIN + 46, y + 31);

  // Contact
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(140, 165, 200);
  doc.text('contact@cabex-ia.com  |  +235 61 47 91 19  |  Langues : Francais, Arabe', MARGIN + 46, y + 40);

  y += 58;

  // Key stats
  const stats = [
    { value: '10+', label: 'Entreprises\naccompagnees' },
    { value: '230+', label: 'Professionnels\nformes' },
    { value: '400+', label: 'Ateliers\ianimes' },
    { value: '10 000+', label: 'Participants\ngrand public' },
  ];

  const statW = (PW - 2 * MARGIN) / stats.length;
  for (let i = 0; i < stats.length; i++) {
    const sx = MARGIN + i * statW;
    doc.setFillColor(250, 249, 246);
    doc.setDrawColor(gr, gg, gb);
    doc.setLineWidth(0.4);
    doc.roundedRect(sx + 2, y, statW - 4, 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(gr, gg, gb);
    doc.text(stats[i].value, sx + statW / 2, y + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(nr, ng, nb);
    const labelLines = stats[i].label.split('\n');
    doc.text(labelLines[0], sx + statW / 2, y + 20, { align: 'center' });
    doc.text(labelLines[1] || '', sx + statW / 2, y + 24.5, { align: 'center' });
  }
  y += 34;

  // Biography
  y = drawSectionTitle(doc, 'Biographie', y);

  const bio = 'Expert-consultant, formateur et conferencier en intelligence artificielle generative, reconnu pour sa capacite a rendre l\'IA concrete, accessible et immediatement utile aux professionnels, aux institutions et aux entreprises. A travers CABEXIA, il accompagne la transformation des pratiques de travail en mettant l\'intelligence artificielle au service de la productivite, de la performance et de la qualite des livrables. Son approche est resolument pratique, orientee resultats et concue pour repondre aux realites du terrain africain.';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(nr, ng, nb);
  const bioLines = doc.splitTextToSize(bio, PW - 2 * MARGIN);
  doc.text(bioLines, MARGIN, y);
  y += bioLines.length * 5 + 10;

  // Expertise tags
  const expertise = ['IA Generative', 'Prompt Engineering Avance', 'Conseil Strategique IA', 'Transformation Digitale', 'Conferences Internationales'];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(nr, ng, nb);
  doc.text('Domaines d\'expertise :', MARGIN, y);
  y += 8;

  let tx = MARGIN;
  for (const tag of expertise) {
    const tw = doc.getTextWidth(tag) + 10;
    if (tx + tw > PW - MARGIN) {
      tx = MARGIN;
      y += 11;
    }
    doc.setFillColor(nr, ng, nb);
    doc.roundedRect(tx, y - 5, tw, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(gr, gg, gb);
    doc.text(tag, tx + 5, y + 0.5);
    tx += tw + 4;
  }
  y += 16;

  // RMK note
  doc.setFillColor(gr, gg, gb);
  doc.roundedRect(MARGIN, y, PW - 2 * MARGIN, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(nr, ng, nb);
  doc.text('Formateur Referent RMK Conseils — Fondateur CABEXIA', PW / 2, y + 9, { align: 'center' });

  drawFooterBar(doc);
}

// ---- Page 6: Tarifs & Inscription ----

function buildPricingPage(doc: jsPDF): void {
  const [nr, ng, nb] = hexToRgb(NAVY);
  const [gr, gg, gb] = hexToRgb(GOLD);

  drawHeaderBar(doc, 6, 6);

  let y = 28;
  y = drawSectionTitle(doc, 'Tarifs & Inscription', y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Formule', 'Tarif', 'Details']],
    body: [
      ['Early Bird', `${fmt(EARLY_BIRD_PRICE)} FCFA`, '-10% si inscription 15 jours avant le debut de l\'atelier'],
      ['Standard', `${fmt(PRICE)} FCFA`, 'Tarif de base par atelier'],
      ...SEMINARS.filter(s => s.price !== PRICE).map(s => [
        `${s.code} - ${s.title}`,
        `${fmt(s.price)} FCFA`,
        `Tarif specifique (early bird : ${fmt(s.earlyBirdPrice)} FCFA)`,
      ]),
      ['Coaching individuel', `${fmt(COACHING_PRICE)} FCFA`, 'Session individuelle de 2h (optionnel)'],
    ],
    headStyles: {
      fillColor: hexToRgb(NAVY),
      textColor: [255, 255, 255],
      font: 'times',
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: hexToRgb(NAVY),
    },
    alternateRowStyles: {
      fillColor: [250, 249, 246],
    },
    styles: {
      cellPadding: 4,
      lineWidth: 0.2,
      lineColor: [200, 200, 200],
    },
  });

  y = ((doc as unknown) as Record<string, Record<string, unknown>>).lastAutoTable?.finalY as number ?? y + 60;
  y += 12;

  y = drawSectionTitle(doc, 'Remises Pack Multi-Ateliers', y);
  const packs = [
    ['2 ateliers', '-10% sur le total'],
    ['3 ateliers', '-15% sur le total'],
    ['4 ateliers (Pack Integral)', '-20% — Acces a tous les ateliers'],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(nr, ng, nb);
  for (const [packLabel, discount] of packs) {
    doc.setFillColor(gr, gg, gb);
    doc.circle(MARGIN + 3, y - 1.2, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(packLabel, MARGIN + 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(discount, MARGIN + 65, y);
    doc.setTextColor(nr, ng, nb);
    y += 7;
  }
  y += 12;

  // Contact box
  doc.setFillColor(nr, ng, nb);
  doc.roundedRect(MARGIN, y, PW - 2 * MARGIN, 55, 3, 3, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(gr, gg, gb);
  doc.text('Comment S\'inscrire ?', PW / 2, y + 14, { align: 'center' });

  const steps = [
    '1.  Contactez-nous par email ou WhatsApp',
    '2.  Remplissez le formulaire d\'inscription en ligne sur rmkconsulting.pro',
    '3.  Recevez votre confirmation et les details pratiques sous 24h',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 215, 235);
  let sy = y + 24;
  for (const step of steps) {
    doc.text(step, PW / 2, sy, { align: 'center' });
    sy += 7;
  }

  doc.setFillColor(gr, gg, gb);
  doc.roundedRect(MARGIN + 10, y + 44, PW - 2 * MARGIN - 20, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(nr, ng, nb);
  doc.text('contact@rmkconsulting.pro  |  WhatsApp +225 07 02 61 15 82', PW / 2, y + 49, { align: 'center' });

  // Final footer
  doc.setFillColor(gr, gg, gb);
  doc.rect(0, PH - 14, PW, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(nr, ng, nb);
  doc.text('(c) 2026 RMK Conseils x CABEXIA  —  Tous droits reserves', PW / 2, PH - 6, { align: 'center' });
}

// ---- Public API ----

export function generateBrochurePdf(selectedIds: Set<string>): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const selected = SEMINARS.filter(s => selectedIds.has(s.id));

  // P1 — Cover
  buildCoverPage(doc);

  // P2 — Ce que vous vivrez
  doc.addPage();
  buildPillarsPage(doc);

  // P3 — Programme jour par jour
  doc.addPage();
  buildProgrammePage(doc);

  // P4 — Nos Formations (seminar cards)
  if (selected.length > 0) {
    doc.addPage();
    buildSeminarsPage(doc, selected);
  }

  // P5 — Formateur
  doc.addPage();
  buildFormateurPage(doc);

  // P6 — Tarifs & Inscription
  doc.addPage();
  buildPricingPage(doc);

  doc.save('Brochure_RMK_CABEXIA_Formations_IA_2026.pdf');
}
