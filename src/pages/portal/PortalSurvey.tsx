// ─────────────────────────────────────────────
// PORTAL SURVEY — Discovery questionnaire component
// ─────────────────────────────────────────────
import React from 'react';
import { NAVY, GOLD, GOLD_DARK, WHITE, GREEN, cardBase, goldButton } from './tokens';
import type { SurveyAnswer } from './tokens';
import { SURVEY_QUESTIONS, getRecommendation } from './surveyConfig';
import type { PortalSection } from './tokens';

export interface PortalSurveyProps {
  surveyStarted: boolean;
  setSurveyStarted: React.Dispatch<React.SetStateAction<boolean>>;
  surveyComplete: boolean;
  setSurveyComplete: React.Dispatch<React.SetStateAction<boolean>>;
  surveyStep: number;
  setSurveyStep: React.Dispatch<React.SetStateAction<number>>;
  surveyAnswers: SurveyAnswer;
  setSurveyAnswers: React.Dispatch<React.SetStateAction<SurveyAnswer>>;
  showEncouragement: boolean;
  setShowEncouragement: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSection: React.Dispatch<React.SetStateAction<PortalSection>>;
}

export default function PortalSurvey({
  surveyStarted, setSurveyStarted,
  surveyComplete, setSurveyComplete,
  surveyStep, setSurveyStep,
  surveyAnswers, setSurveyAnswers,
  showEncouragement, setShowEncouragement,
  setActiveSection,
}: PortalSurveyProps) {

  const handleSurveyAnswer = (questionId: string, value: string | string[]) => {
    setSurveyAnswers(prev => ({ ...prev, [questionId]: value }));
    setShowEncouragement(true);
    setTimeout(() => {
      setShowEncouragement(false);
      if (surveyStep < SURVEY_QUESTIONS.length - 1) {
        setSurveyStep(prev => prev + 1);
      } else {
        setSurveyComplete(true);
      }
    }, 1200);
  };

  if (!surveyStarted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 40px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
          color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px',
        }}>
          &#10024;
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 12 }}>
          Decouvrez votre potentiel IA
        </h2>
        <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 16, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 32px' }}>
          En quelques questions, nous identifierons la formation la plus adaptee a vos besoins et a votre contexte professionnel.
        </p>
        <button onClick={() => setSurveyStarted(true)} style={{ ...goldButton(), fontSize: 16, padding: '16px 40px' }}>
          Commencer le questionnaire
        </button>
      </div>
    );
  }

  if (surveyComplete) {
    const recommendation = getRecommendation(surveyAnswers);
    return (
      <div style={{ padding: '40px 32px' }}>
        <div style={{
          textAlign: 'center', marginBottom: 32,
          background: `linear-gradient(135deg, rgba(201,168,76,0.08), rgba(27,42,74,0.04))`,
          borderRadius: 20, padding: '48px 32px',
          border: '1px solid rgba(201,168,76,0.15)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#127942;</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 12 }}>
            Votre recommandation personnalisee
          </h2>
          <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
            Base sur vos reponses, nous vous recommandons :
          </p>
          <div style={{
            ...cardBase, padding: '24px 28px', maxWidth: 480, margin: '0 auto',
            borderLeft: `4px solid ${GOLD}`,
          }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.6, margin: 0 }}>
              {recommendation}
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <button onClick={() => { setSurveyStarted(false); setSurveyComplete(false); setSurveyStep(0); }} style={{
            padding: '14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
            background: 'transparent', color: 'rgba(27,42,74,0.5)', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
          }}>
            Recommencer
          </button>
          <button onClick={() => setActiveSection('dashboard')} style={goldButton()}>
            Voir les formations
          </button>
        </div>
      </div>
    );
  }

  // Active question
  const q = SURVEY_QUESTIONS[surveyStep];
  const progress = ((surveyStep + 1) / SURVEY_QUESTIONS.length) * 100;

  return (
    <div style={{ padding: '40px 32px' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', fontWeight: 600 }}>
            Question {surveyStep + 1} / {SURVEY_QUESTIONS.length}
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: GOLD, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Encouragement */}
      {showEncouragement && (
        <div style={{
          textAlign: 'center', marginBottom: 24, padding: '12px 20px',
          background: 'rgba(39,174,96,0.08)', borderRadius: 12,
          color: GREEN, fontWeight: 700, fontSize: 15,
          animation: 'fadeIn 0.3s ease',
        }}>
          {SURVEY_QUESTIONS[surveyStep]?.encouragement}
        </div>
      )}

      {/* Question */}
      {!showEncouragement && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 24, lineHeight: 1.4 }}>
            {q.label}
          </h3>

          {q.type === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map(opt => (
                <button key={opt} onClick={() => handleSurveyAnswer(q.id, opt)} style={{
                  padding: '16px 20px', borderRadius: 12, textAlign: 'left',
                  border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)',
                  color: NAVY, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s',
                  fontWeight: 500,
                }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = GOLD;
                    e.currentTarget.style.background = 'rgba(201,168,76,0.06)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'text' && (
            <div>
              <textarea
                value={surveyAnswers.defi}
                onChange={e => setSurveyAnswers(prev => ({ ...prev, defi: e.target.value }))}
                placeholder="Decrivez brievement..."
                rows={3}
                style={{
                  width: '100%', padding: '14px 18px', borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)',
                  color: NAVY, fontSize: 15, outline: 'none', resize: 'vertical',
                  fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = GOLD; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; }}
              />
              <button
                onClick={() => surveyAnswers.defi.trim() && handleSurveyAnswer(q.id, surveyAnswers.defi)}
                disabled={!surveyAnswers.defi.trim()}
                style={{ ...goldButton(!surveyAnswers.defi.trim()), marginTop: 14 }}
              >
                Continuer
              </button>
            </div>
          )}

          {q.type === 'multi' && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {q.options.map(opt => {
                  const isSelected = surveyAnswers.attentes.includes(opt);
                  return (
                    <button key={opt} onClick={() => {
                      setSurveyAnswers(prev => ({
                        ...prev,
                        attentes: isSelected
                          ? prev.attentes.filter(x => x !== opt)
                          : [...prev.attentes, opt],
                      }));
                    }} style={{
                      padding: '10px 18px', borderRadius: 20, fontSize: 14,
                      border: isSelected ? `2px solid ${GOLD}` : '2px solid rgba(0,0,0,0.08)',
                      background: isSelected ? 'rgba(201,168,76,0.1)' : 'transparent',
                      color: isSelected ? GOLD_DARK : 'rgba(27,42,74,0.6)',
                      fontWeight: isSelected ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => surveyAnswers.attentes.length > 0 && handleSurveyAnswer(q.id, surveyAnswers.attentes)}
                disabled={surveyAnswers.attentes.length === 0}
                style={goldButton(surveyAnswers.attentes.length === 0)}
              >
                Continuer
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
