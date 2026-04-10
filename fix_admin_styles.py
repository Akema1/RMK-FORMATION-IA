import os

file = 'src/pages/AdminDashboard.tsx'
with open(file, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix common white texts that were missed (no space)
c = c.replace('color:"#fff"', 'color:"#0F172A"')
c = c.replace('color: "#fff"', 'color: "#0F172A"')
c = c.replace('color: "#0a0a0a"', 'color: "#0F172A"')

# Fix specific component backgrounds
c = c.replace('background:"rgba(0,0,0,0.06)", color:"#fff"', 'background:"rgba(0,0,0,0.06)", color:"#0F172A"')
c = c.replace('background:"rgba(11,17,32,0.98)"', 'background:"#FFFFFF"') # Navigation Sidebar
c = c.replace('color:"rgba(0,0,0,0.35)"', 'color:"rgba(15,23,42,0.5)"') # Sidebar sub-text
c = c.replace('rgba(255,255,255,0.', 'rgba(15,23,42,0.') # All remaining white translucent -> Navy translucent

# Ensure primary buttons have white text so they are legible on the gradient
c = c.replace('btnPrimary = { background:`linear-gradient(135deg,${ORANGE},#D4580F)`, color:"#0F172A"', 'btnPrimary = { background:`linear-gradient(135deg,${ORANGE},#A88A3D)`, color:"#fff"')

with open(file, 'w', encoding='utf-8') as f:
    f.write(c)

print("AdminDashboard styles fixed.")
