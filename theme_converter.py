import os

files = ['src/pages/LandingPage.tsx', 'src/pages/ClientPortal.tsx', 'src/pages/AdminDashboard.tsx', 'src/pages/NotFound.tsx']
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Apply the elegant Executive Ivory theme
    # Backgrounds
    content = content.replace('#1A2332', '#FAF9F6') # Main body to Ivory
    content = content.replace('linear-gradient(170deg, #1A2332', 'linear-gradient(170deg, #FAF9F6')
    content = content.replace('linear-gradient(170deg, #FAF9F6, #1B2A4A)', 'linear-gradient(170deg, #FAF9F6, #E0DCCD)') # Soft gradient for ivory
    content = content.replace('#11112B', '#FAF9F6') # flyer background

    # Text Colors - Darken whites to Black/Navy for contrast on ivory bg
    content = content.replace('color: "#fff"', 'color: "#0a0a0a"')
    content = content.replace("color: '#fff'", "color: '#0a0a0a'")
    content = content.replace('color: "white"', 'color: "#0a0a0a"')
    content = content.replace("color: '#E2E8F0'", "color: '#1A2332'")
    content = content.replace('color: "#E2E8F0"', 'color: "#1A2332"')
    content = content.replace('color: "#CBD5E1"', 'color: "#475569"')

    # Fix Logo display: on light background we need the colored/dark logo
    content = content.replace('variant="dark"', 'variant="light"')

    # Translucent boxes and borders (invert white alphas to black alphas)
    content = content.replace('rgba(255,255,255,0.', 'rgba(0,0,0,0.')

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Theme conversion to Ivory completed.")
