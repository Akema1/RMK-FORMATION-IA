import os

file_logo = 'src/components/LogoRMK.tsx'
with open(file_logo, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('width="84" height="62"', 'width="84" height="56"')
content = content.replace('y="76"', 'y="78"')

with open(file_logo, 'w', encoding='utf-8') as f:
    f.write(content)

file_landing = 'src/pages/LandingPage.tsx'
with open(file_landing, 'r', encoding='utf-8') as f:
    landing = f.read()

# Replace all occurrences of LogoRMK scale 0.5 (Navbar & Footer) with dark variant
landing = landing.replace('<LogoRMK scale={0.5} variant="light" />', '<LogoRMK scale={0.5} variant="dark" />')

with open(file_landing, 'w', encoding='utf-8') as f:
    f.write(landing)

print('Update successful.')
