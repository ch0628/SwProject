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

def print_area(cx, cy, radius=10):
    print(f"Area around ({cx}, {cy}):")
    for y in range(cy-radius, cy+radius+1):
        row = f"{y:2d} "
        for x in range(cx-radius, cx+radius+1):
            if x < 0 or x >= w or y < 0 or y >= h:
                row += ' '
            else:
                tile = ground[y * w + x]
                # mark center
                if x == cx and y == cy:
                    row += 'T'
                else:
                    row += chars.get(tile, '?')
        print(row)

# Print around tiger
print_area(67, 29, 12)
