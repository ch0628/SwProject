import json

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

w, h = d['width'], d['height']
ground = None
for l in d['layers']:
    if l['name'] == 'Ground':
        ground = l['data']
        break

chars = {0: ' ', 1: '.', 2: '#', 3: '=', 4: '+', 5: ':', 6: '-', 7: '*'}
print("Central plaza area:")
for y in range(25, 45):
    row = f"{y:2d} "
    for x in range(30, 65):
        tile = ground[y * w + x]
        row += chars.get(tile, '?')
    print(row)
