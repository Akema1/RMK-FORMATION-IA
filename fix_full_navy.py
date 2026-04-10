import os
import re

files = ['src/pages/AdminDashboard.tsx', 'src/pages/ClientPortal.tsx', 'src/pages/LandingPage.tsx']

for f_path in files:
    with open(f_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # 1. Replace the slate color #475569 with the deep classic Navy #1B2A4A globally
    content = content.replace('#475569', '#1B2A4A')
    
    # 2. Find any remaining 'color: "rgba(0,0,0,0.X)"' and replace with Navy.
    content = re.sub(r'color:\s*[\'\"]rgba\(0,\s*0,\s*0,\s*0\.[1-9]\d*\)[\'\"]', 'color: "#1B2A4A"', content)
    
    # 3. Handle explicit rgba statements without quotes in style dicts: color: rgba(0,0,0,0.5)
    content = re.sub(r'color:\s*rgba\(0,\s*0,\s*0,\s*0\.[1-9]\d*\)', 'color: "#1B2A4A"', content)
    
    # 4. Make sure empty placeholders or faint placeholders also become a bit stronger? No, placeholders wait.
    
    with open(f_path, 'w', encoding='utf-8') as file:
        file.write(content)
        
print("Replaced all Slate and grey rgba text with pure Navy.")
