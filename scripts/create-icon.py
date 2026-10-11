"""Build Dayflow's pixel icon sources and Windows sizes with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parents[1] / 'assets' / 'icon'
destination.mkdir(parents=True, exist_ok=True)
ink, purple, lavender, cream, mint = '#39324b', '#7560b2', '#b4a2da', '#fffdf4', '#d9ead4'
shapes = [
    ('polygon', [(10,10),(54,10),(54,14),(58,14),(58,54),(54,54),(54,58),(14,58),(14,54),(10,54)], '#cfc5cc'),
    ('polygon', [(6,8),(50,8),(50,12),(54,12),(54,50),(50,50),(50,54),(10,54),(10,50),(6,50)], ink),
    ('rect', (10,12,50,50), cream),
    ('rect', (10,12,50,24), purple),
    ('rect', (10,24,50,28), ink),
    ('rect', (14,4,22,20), ink),
    ('rect', (18,8,22,16), lavender),
    ('rect', (38,4,46,20), ink),
    ('rect', (42,8,46,16), lavender),
    ('rect', (14,32,22,36), mint),
    ('rect', (14,40,22,44), mint),
    ('polygon', [(30,28),(42,28),(42,32),(46,32),(46,44),(42,44),(42,48),(30,48),(30,44),(26,44),(26,32),(30,32)], ink),
    ('polygon', [(30,32),(42,32),(42,44),(30,44)], lavender),
    ('rect', (34,32,38,40), ink),
    ('rect', (34,36,42,40), ink),
    ('rect', (46,42,58,54), ink),
    ('rect', (42,46,54,58), ink),
    ('polygon', [(42,46),(46,46),(46,50),(50,50),(50,46),(54,46),(54,42),(58,42),(58,50),(54,50),(54,54),(50,54),(50,58),(46,58),(46,54),(42,54)], '#367f77'),
]
image = Image.new('RGBA', (1024,1024), (0,0,0,0))
draw = ImageDraw.Draw(image)
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">']
for kind, coordinates, color in shapes:
    if kind == 'rect':
        x1,y1,x2,y2 = coordinates
        draw.rectangle((x1*16,y1*16,x2*16-1,y2*16-1), fill=color)
        svg.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" fill="{color}"/>')
    else:
        # Rasterize on the native pixel grid to keep every edge consistent.
        layer = Image.new('RGBA',(64,64),(0,0,0,0))
        ImageDraw.Draw(layer).polygon(coordinates, fill=color)
        image.alpha_composite(layer.resize(image.size, Image.Resampling.NEAREST))
        svg.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in coordinates)}" fill="{color}"/>')
svg.append('</svg>')
(destination/'dayflow.svg').write_text('\n'.join(svg), encoding='utf-8')
image.save(destination/'dayflow.png')
sizes = [(size,size) for size in (16,24,32,48,64,128,256)]
frames = [image.resize(size,Image.Resampling.NEAREST) for size in sizes]
frames[-1].save(destination/'dayflow.ico',format='ICO',sizes=sizes,append_images=frames[:-1])
