// ─────────────────────────────────────────────
// PORTAL COMMUNITY — Participant feed & filter
// ─────────────────────────────────────────────
import React, { useState } from 'react';
import { SEMINARS } from '../../data/seminars';
import { NAVY, GOLD, GOLD_DARK, cardBase, goldButton } from './tokens';
import type { CommunityPost } from './tokens';
import { getInitials } from './tokens';
import type { Participant } from '../../admin/types';
import { postCommunityPost } from '../../lib/communityApi';

export interface PortalCommunityProps {
  participant: Participant;
  communityPosts: CommunityPost[];
  setCommunityPosts: React.Dispatch<React.SetStateAction<CommunityPost[]>>;
  newPostText: string;
  setNewPostText: React.Dispatch<React.SetStateAction<string>>;
  communityFilter: string;
  setCommunityFilter: React.Dispatch<React.SetStateAction<string>>;
}

export default function PortalCommunity({
  participant,
  communityPosts, setCommunityPosts,
  newPostText, setNewPostText,
  communityFilter, setCommunityFilter,
}: PortalCommunityProps) {
  const filterOptions = ['Tous', ...SEMINARS.map(s => s.code)];
  const filteredPosts = communityFilter === 'Tous'
    ? communityPosts
    : communityPosts.filter(p => p.seminarTag === communityFilter);

  const [posting, setPosting] = useState(false);

  const addCommunityPost = async () => {
    if (!newPostText.trim() || posting) return;
    setPosting(true);

    const { post, error } = await postCommunityPost({
      text: newPostText.trim(),
    });

    if (error || !post) {
      console.error('Post failed:', error);
      setPosting(false);
      return;
    }

    // Server is authoritative: use the returned post (which has server-computed
    // id, author, initials, date, AND seminarTag).
    setCommunityPosts(prev => [post, ...prev]);
    setNewPostText('');
    setPosting(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Communaute RMK</h1>
        <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15 }}>
          Echangez avec les autres participants de votre promotion.
        </p>
      </div>

      {/* Post form */}
      <div style={{ ...cardBase, padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
            color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14,
          }}>
            {getInitials(`${participant.prenom} ${participant.nom}`)}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              value={newPostText}
              onChange={e => setNewPostText(e.target.value)}
              placeholder="Partagez une reflexion, une question..."
              rows={3}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)',
                color: NAVY, fontSize: 14, outline: 'none', resize: 'vertical',
                fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = GOLD; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                onClick={addCommunityPost}
                disabled={!newPostText.trim() || posting}
                style={{ ...goldButton(!newPostText.trim() || posting), padding: '10px 24px', fontSize: 14 }}
              >
                {posting ? 'Publication...' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {filterOptions.map(f => (
          <button key={f} onClick={() => setCommunityFilter(f)} style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            border: communityFilter === f ? `1px solid ${GOLD}` : '1px solid rgba(0,0,0,0.08)',
            background: communityFilter === f ? 'rgba(201,168,76,0.1)' : 'transparent',
            color: communityFilter === f ? GOLD_DARK : 'rgba(27,42,74,0.5)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Posts feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filteredPosts.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(27,42,74,0.4)' }}>
            Aucun message pour ce filtre.
          </div>
        )}
        {filteredPosts.map(post => (
          <div key={post.id} style={{ ...cardBase, padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: NAVY, color: GOLD,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13,
              }}>
                {post.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{post.author}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    background: 'rgba(201,168,76,0.1)', color: GOLD_DARK,
                  }}>
                    {post.seminarTag}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(27,42,74,0.35)', marginLeft: 'auto' }}>
                    {post.date}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(27,42,74,0.75)', lineHeight: 1.6, margin: 0 }}>
                  {post.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
