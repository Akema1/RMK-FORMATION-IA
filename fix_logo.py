import os
import re

file_logo = 'src/components/LogoRMK.tsx'

with open(file_logo, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the y-coordinate of CONSEILS so it doesn't overlap the RMK letters
content = content.replace('y="50"', 'y="76"')

# Fix the color so it's always Gold (C9A84C) and highly visible
color_regex = r"const conseilsColor = variant === 'dark' \? '[^']*' : '[^']*';"
content = re.sub(color_regex, "const conseilsColor = '#C9A84C';", content)

with open(file_logo, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Update {file_logo} OK.")


file_landing = 'src/pages/LandingPage.tsx'
with open(file_landing, 'r', encoding='utf-8') as f:
    content_landing = f.read()

# Insert the logo above the date in the Hero component
target_str = '<div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 100, padding: "6px 20px", marginBottom: 32 }}>'
replacement_str = '<div style={{ marginBottom: 32, display: "flex", justifyContent: "center" }}><LogoRMK scale={1.8} variant="light" /></div>\n          ' + target_str

if '<LogoRMK scale={1.8} variant="light" />' not in content_landing:
    content_landing = content_landing.replace(target_str, replacement_str)

with open(file_landing, 'w', encoding='utf-8') as f:
    f.write(content_landing)
    
print(f"Update {file_landing} OK.")

