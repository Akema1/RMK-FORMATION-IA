import os

file_path = 'src/pages/LandingPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Navbar Logo
content = content.replace(
    '<div style={{ color: "#1B2A4A", fontWeight: 700, fontSize: 15, letterSpacing: 0.5, lineHeight: 1.1 }}>RMK <span style={{ color: "#C9A84C" }}>×</span> CABEXIA</div>',
    '<div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15, letterSpacing: 0.5, lineHeight: 1.1 }}>RMK <span style={{ color: "#C9A84C" }}>×</span> CABEXIA</div>'
)

# Fix Navbar subtitle
content = content.replace(
    '<div style={{ color: \'#475569\', fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>Formation IA à Abidjan</div>',
    '<div style={{ color: "#94A3B8", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>Formation IA à Abidjan</div>'
)

# Fix Navbar Links
content = content.replace(
    'color: page === l.key ? "#C9A84C" : "rgba(0,0,0,0.7)"',
    'color: page === l.key ? "#C9A84C" : "#E2E8F0"'
)

# Fix Client Portal/Admin buttons in Navbar
content = content.replace(
    'border: "1px solid rgba(0,0,0,0.2)", color: \'#475569\'',
    'border: "1px solid rgba(255,255,255,0.2)", color: "#E2E8F0"'
)

content = content.replace(
    'border: "1px solid rgba(0,0,0,0.1)", color: \'#475569\'',
    'border: "1px solid rgba(255,255,255,0.2)", color: "#E2E8F0"'
)

# Fix Mobile menu button
content = content.replace(
    '<div className="nav-mobile-btn" style={{ fontSize: 24, cursor: "pointer", color: "#1B2A4A" }} onClick={() => setMobileOpen(true)}>☰</div>',
    '<div className="nav-mobile-btn" style={{ fontSize: 24, cursor: "pointer", color: "#FFFFFF" }} onClick={() => setMobileOpen(true)}>☰</div>'
)

# Fix Footer Background (maybe make it Navy instead of `#0B1120`, let's keep it Dark Navy but fix text)
# Footer logo
content = content.replace(
    '<span style={{ color: "#1B2A4A", fontWeight: 700, fontSize: 15 }}>RMK <span style={{ color: "#C9A84C" }}>×</span> CABEXIA</span>',
    '<span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15 }}>RMK <span style={{ color: "#C9A84C" }}>×</span> CABEXIA</span>'
)

# Footer desc
desc_old = "<p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7 }}>Organisé par RMK à Abidjan. Formations délivrées par CABEXIA, Cabinet d'Expertise en Intelligence Artificielle.</p>"
desc_new = "<p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.7 }}>Organisé par RMK à Abidjan. Formations délivrées par CABEXIA, Cabinet d'Expertise en Intelligence Artificielle.</p>"
content = content.replace(desc_old, desc_new)

# Footer Contact text
contact_title_old = 'color: \'#475569\', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Contact</div>'
contact_title_new = 'color: "#94A3B8", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Contact</div>'
content = content.replace(contact_title_old, contact_title_new)

nav_title_old = 'color: \'#475569\', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Navigation</div>'
nav_title_new = 'color: "#94A3B8", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Navigation</div>'
content = content.replace(nav_title_old, nav_title_new)

# Footer Contact lines (emails, phone)
content = content.replace(
    '<div style={{ color: \'#475569\', fontSize: 14, lineHeight: 2 }}>',
    '<div style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 2 }}>'
)

# Footer Links
content = content.replace(
    'color: \'#475569\', cursor: "pointer"',
    'color: "#CBD5E1", cursor: "pointer"'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("LandingPage styling updated to fix contrast on Navy backgrounds.")
