import os
import re

files = ['src/pages/LandingPage.tsx', 'src/pages/ClientPortal.tsx', 'src/pages/AdminDashboard.tsx']
NAVY = '#1B2A4A'
SLATE = '#475569'

def replace_in_file(filepath):
    if not os.path.exists(filepath):
        print(f"Not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        c = f.read()

    # 1. Primary Text
    c = c.replace('#0a0a0a', NAVY)
    c = c.replace('#0F172A', NAVY)
    
    # 2. Secondary Text (rgba variants)
    # Target things like rgba(0,0,0,0.4), rgba(0,0,0,0.35), rgba(0,0,0,0.5), rgba(0,0,0,0.6), rgba(0,0,0,0.7)
    c = re.sub(r'color:\s*[\'"]rgba\(0,\s*0,\s*0,\s*0\.[3-7]\d*\)[\'"]', f"color: '{SLATE}'", c)
    c = re.sub(r'color:\s*rgba\(0,\s*0,\s*0,\s*0\.[3-7]\d*\)', f"color: '{SLATE}'", c)
    c = re.sub(r'color:\s*\"rgba\(0,0,0,0\.[3-7]\d*\)\"', f'color: "{SLATE}"', c)
    c = re.sub(r'color:\"rgba\(0,0,0,0\.[3-7]\d*\)\"', f'color:"{SLATE}"', c)
    
    # Also fix explicit string replacements
    c = c.replace("color: 'rgba(0,0,0,0.7)'", f"color: '{SLATE}'")
    c = c.replace('color: "rgba(0,0,0,0.7)"', f'color: "{SLATE}"')
    
    # Fix 3: For the Navbar, making links white on dark background in LandingPage.
    # In LandingPage, we have: `background: page === l.key ? "rgba(201,168,76,0.15)" : "transparent", border: "none", color: page === l.key ? "#C9A84C" : NAVY,`
    c = c.replace(f'color: page === l.key ? "#C9A84C" : {NAVY}', 'color: page === l.key ? "#C9A84C" : "#FFFFFF"')
    c = c.replace(f'color: page === l.key ? "#C9A84C" : "{NAVY}"', 'color: page === l.key ? "#C9A84C" : "#FFFFFF"')
    
    # Fix the generic links in nav desktop
    # `color: "rgba(0,0,0,0.7)"` -> `#FFFFFF` inside Nav links. We can just explicitly assign it to white for the navbar.
    
    # 4. Navbar backgrounds
    c = c.replace('15,23,42', '27,42,74')
    c = c.replace('11,17,32', '27,42,74')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Processed {filepath}")

for f in files:
    replace_in_file(f)

