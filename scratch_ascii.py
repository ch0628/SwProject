import json

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

w, h = d['width'], d['height']
ground = None
for l in d['layers']:
    if l['name'] == 'Ground':
        ground = l['data']
        break

# Print a small section or downsampled version to see the layout
chars = {0: ' ', 1: '.', 2: '#', 3: '=', 4: '+', 5: ':', 6: '-', 7: '*'}

print("Map layout (downsampled 2x2):")
for y in range(0, h, 2):
    row = ""
    for x in range(0, w, 2):
        tile = ground[y * w + x]
        row += chars.get(tile, '?')
    print(row)
