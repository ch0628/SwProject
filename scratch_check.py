import json

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

w, h = d['width'], d['height']
ground = None
for l in d['layers']:
    if l['name'] == 'Ground':
        ground = l['data']
        break

def get_tile(tx, ty):
    if tx < 0 or tx >= w or ty < 0 or ty >= h: return 0
    return ground[ty * w + tx]

path_tiles = {3, 4, 5, 6}
grass_tile = 2

def is_path(tx, ty): return get_tile(tx, ty) in path_tiles
def is_grass(tx, ty): return get_tile(tx, ty) == grass_tile

def find_bench_spot(cx, cy, radius=8):
    best_spot = None
    min_dist = 9999
    for ty in range(cy-radius, cy+radius+1):
        for tx in range(cx-radius, cx+radius+1):
            if is_grass(tx, ty) and (is_path(tx+1, ty) or is_path(tx-1, ty) or is_path(tx, ty+1) or is_path(tx, ty-1)):
                dist = ((tx-cx)**2 + (ty-cy)**2)**0.5
                if dist < min_dist:
                    min_dist = dist
                    best_spot = (tx, ty)
    return best_spot

targets = [
    (24, 14), # Top-left
    (48, 14), # Top-mid
    (34, 24), # Mid-left
    (64, 32), # Mid-right (below tiger at 67, 29)
    (76, 22), # Far-right top
    (80, 40)  # Far-right bottom
]

for t in targets:
    print(f"Target {t} -> Spot {find_bench_spot(*t)}")

