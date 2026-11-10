"""Builds icons/icon.svg: a stemless whole note whose body is the colour wheel,
with a C-major chord triangle (C, E, G dots joined by lines) across its hollow.
Run: python3 tools/make_icon.py  (then tools/render_icons.sh for the PNGs)"""
import math, colorsys

HUES = [0, 28, 54, 88, 134, 168, 192, 218, 248, 276, 304, 334]   # app's chromatic map
SATS = [88, 92, 94, 82, 82, 84, 90, 90, 84, 86, 88, 88]
CX, CY = 256, 262
OUT = dict(rx=192, ry=136, rot=-20)   # outer oval of the whole note
INN = dict(rx=104, ry=60, rot=62)      # the slanted hollow

def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))

def hue_at(a):  # a = degrees clockwise from top; interpolate the 12 note hues
    s = a / 30.0
    i = int(math.floor(s)) % 12; j = (i + 1) % 12; t = s - math.floor(s)
    h0, h1 = HUES[i], HUES[j] + (360 if HUES[j] < HUES[i] else 0)
    return (h0 + (h1 - h0) * t) % 360, SATS[i] + (SATS[j] - SATS[i]) * t

def ell_r(e, theta):  # distance from centre to ellipse edge along direction theta (math angle, rad)
    phi = theta - math.radians(e['rot'])
    return 1 / math.sqrt((math.cos(phi) / e['rx']) ** 2 + (math.sin(phi) / e['ry']) ** 2)

def pt(a_deg, r):  # a = degrees clockwise from top
    th = math.radians(a_deg)
    return CX + r * math.sin(th), CY - r * math.cos(th)

def ring_mid(a_deg):
    th = math.atan2(-math.cos(math.radians(a_deg)), math.sin(math.radians(a_deg)))  # to math angle
    th = math.radians(90 - a_deg)  # clockwise-from-top -> standard math angle (y up)
    # SVG y is down, so mirror: direction (sin a, -cos a)
    dirx, diry = math.sin(math.radians(a_deg)), -math.cos(math.radians(a_deg))
    theta = math.atan2(diry, dirx)
    ro, ri = ell_r(OUT, theta), ell_r(INN, theta)
    m = (ro + ri) / 2
    return CX + dirx * m, CY + diry * m

def ellipse(e, extra=''):
    return f'<ellipse cx="{CX}" cy="{CY}" rx="{e["rx"]}" ry="{e["ry"]}" transform="rotate({e["rot"]} {CX} {CY})" {extra}/>'

wedges = []
N = 180
for k in range(N):
    a0, a1 = k * 360 / N, (k + 1.15) * 360 / N
    h, s = hue_at((a0 + a1) / 2)
    x0, y0 = pt(a0, 300); x1, y1 = pt(a1, 300)
    wedges.append(f'<path d="M{CX} {CY} L{x0:.2f} {y0:.2f} L{x1:.2f} {y1:.2f}Z" fill="{hsl(h, s, 56)}"/>')

# chord: C (0°), E (4 semitones = 120°... use the note's hue position), G
notes = [(0, 'C'), (4, 'E'), (7, 'G')]
pts = []
for pc, _ in notes:
    a = pc * 30  # slot on the wheel
    pts.append((ring_mid(a), hsl(HUES[pc], SATS[pc], 58)))

tri = ' '.join(f'{x:.1f},{y:.1f}' for (x, y), _ in pts)
dots = ''.join(
    f'<circle cx="{x:.1f}" cy="{y:.1f}" r="30" fill="{c}" stroke="#fff" stroke-width="9" filter="url(#glow)"/>'
    for (x, y), c in pts)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#1d2233"/><stop offset="1" stop-color="#07080d"/>
    </radialGradient>
    <mask id="noteMask">
      {ellipse(OUT, 'fill="#fff"')}
      {ellipse(INN, 'fill="#000"')}
    </mask>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g mask="url(#noteMask)" filter="url(#soft)" opacity="0.55">{''.join(wedges)}</g>
  <g mask="url(#noteMask)">{''.join(wedges)}
    {ellipse(OUT, 'fill="url(#sheen)"')}
  </g>
  {ellipse(INN, 'fill="#0b0d14"')}
  <polygon points="{tri}" fill="#ffffff" fill-opacity="0.10" stroke="#fff" stroke-width="10" stroke-linejoin="round" stroke-opacity="0.95"/>
  {dots}
</svg>
'''
open('icons/icon.svg', 'w').write(svg)
print('wrote icons/icon.svg')
