import json

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

w, h = d['width'], d['height']
ground = None
for l in d['layers']:
    if l['name'] == 'Ground':
        ground = l['data']
        break

grass_tile = 2
path_tiles = {3, 4, 5, 6}

def get_tile(tx, ty):
    if tx < 0 or tx >= w or ty < 0 or ty >= h:
        return 0
    return ground[ty * w + tx]

def is_path(tx, ty): return get_tile(tx, ty) in path_tiles
def is_grass(tx, ty): return get_tile(tx, ty) == grass_tile

def find_bench_spot(cx, cy, radius=5):
    best_spot = None
    min_dist = 9999
    for ty in range(cy-radius, cy+radius+1):
        for tx in range(cx-radius, cx+radius+1):
            if is_grass(tx, ty):
                # Must be adjacent to path
                if (is_path(tx+1, ty) or is_path(tx-1, ty) or 
                    is_path(tx, ty+1) or is_path(tx, ty-1)):
                    dist = ((tx-cx)**2 + (ty-cy)**2)**0.5
                    if dist < min_dist:
                        min_dist = dist
                        best_spot = (tx, ty)
    return best_spot

# Approximate target locations based on visual estimate of tiles
targets = [
    (24, 18), # Top-left above horiz path
    (48, 18), # Top-mid above horiz path
    (34, 27), # Mid-left, below horiz path
    (54, 27), # Mid, left of character
    (74, 28), # Mid-right above right path
    (74, 35)  # Bottom-right below right path
]

print("Bench spots:")
for t in targets:
    spot = find_bench_spot(t[0], t[1], 8)
    print(f"Target {t} -> Spot {spot}")
