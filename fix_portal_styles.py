import os

file = 'src/pages/ClientPortal.tsx'
with open(file, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix common white texts that were missed
c = c.replace('color:"#fff"', 'color:"#0F172A"')
c = c.replace("color:'#fff'", "color:'#0F172A'")
c = c.replace("color: '#fff'", "color: '#0F172A'")
c = c.replace('color: "#fff"', 'color: "#0F172A"')
c = c.replace('color: "#0a0a0a"', 'color: "#0F172A"')

# Fix specific component backgrounds
c = c.replace("background: 'rgba(0,0,0,0.3)'", "background: '#FFFFFF'") # Sidebar
c = c.replace("background: 'rgba(0,0,0,0.98)'", "background: '#FFFFFF'") # Header/Mobile bg
c = c.replace('rgba(255,255,255,0.', 'rgba(15,23,42,0.') # All remaining white translucent -> Navy translucent

# Revert button text to white if needed
c = c.replace('background: `linear-gradient(135deg, ${ORANGE}, #A88A3D)`, color: "#0F172A"', 'background: `linear-gradient(135deg, ${ORANGE}, #A88A3D)`, color: "#FFFFFF"')

with open(file, 'w', encoding='utf-8') as f:
    f.write(c)

print("ClientPortal styles fixed.")
