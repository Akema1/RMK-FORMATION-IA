import os

file = 'src/pages/ClientPortal.tsx'
with open(file, 'r', encoding='utf-8') as f:
    c = f.read()

# Add calendar notification
alert = '''      {/* NOTIFICATION BAREER (DATE CHANGES) */}
        <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>📅</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#E74C3C' }}>ALERTE DE CALENDRIER</div>
            <div style={{ fontSize: 13, color: '#0F172A' }}>Attention : Veuillez vérifier les dates de vos sessions dans l'onglet 'Programme' suite à de récentes mises à jour.</div>
          </div>
        </div>

        {/* ─── TAB: OVERVIEW ─── */}'''
c = c.replace('{/* ─── TAB: OVERVIEW ─── */}', alert)

# Update phone numbers
c = c.replace('+225 07 00 00 00 00', '+225 07 02 61 15 82')

# Add Bank Transfer block
virement = '''</div>

                <div style={{ background: 'rgba(41, 128, 185, 0.1)', border: '1px solid rgba(41, 128, 185, 0.3)', borderRadius: 14, padding: 24, marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>🏦</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#2980B9' }}>Virement Bancaire</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)', marginBottom: 16 }}>
                    Pour les virements bancaires, veuillez nous contacter directement pour recevoir la facture pro-forma et le Relevé d'Identité Bancaire (RIB) de RMK Consulting.
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <a href='mailto:rkedem@rmkconsulting.pro' style={{ display: 'inline-block', background: '#2980B9', color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Obtenir le RIB par Email</a>
                    <a href='https://wa.me/2250702611582' style={{ display: 'inline-block', background: 'rgba(41, 128, 185, 0.2)', color: '#2980B9', textDecoration: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Demander sur WhatsApp</a>
                  </div>
                </div>'''

target_div = '''Envoyez le montant exact et transmettez la capture de reçu via WhatsApp.</div>
                  </div>
                </div>'''
rep_div = f'''Envoyez le montant exact et transmettez la capture de reçu via WhatsApp.</div>
                  </div>
                </div>
{virement}'''

c = c.replace(target_div, rep_div)

with open(file, 'w', encoding='utf-8') as f:
    f.write(c)

print('ClientPortal alerts and payments updated.')
