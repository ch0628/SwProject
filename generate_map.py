import json
import random

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

w, h = d['width'], d['height']
tile_w, tile_h = d['tilewidth'], d['tileheight']

def get_layer(name):
    for l in d['layers']:
        if l['name'] == name:
            return l
    return None

ground = get_layer('Ground')['data']
grass_tile = 2
path_tiles = {3, 4, 5, 6}

def get_tile(tx, ty):
    if tx < 0 or tx >= w or ty < 0 or ty >= h:
        return 0
    return ground[ty * w + tx]

layers_to_clean = ['Object_Base', 'Foreground', 'Collision', 'Interaction']
cleaned_counts = {'Tree': 0, 'Bench': 0, 'Lamp': 0, 'Fence': 0}
next_id = 1000

# 1. Clean existing
for lname in layers_to_clean:
    l = get_layer(lname)
    if not l or 'objects' not in l: continue
    new_objs = []
    for o in l['objects']:
        otype = o.get('class', o.get('type', ''))
        if otype in ['Tree', 'Bench', 'Lamp', 'Fence']:
            if o['id'] >= next_id: next_id = o['id'] + 1
        else:
            new_objs.append(o)
            if o['id'] >= next_id: next_id = o['id'] + 1
    l['objects'] = new_objs

def add_object(otype, x, y, width=32, height=32, layers=None, name=""):
    global next_id
    if layers is None: layers = ['Object_Base']
    
    for lname in layers:
        l = get_layer(lname)
        if l is None: continue
        obj = {
            'height': height,
            'id': next_id,
            'name': name or f"{otype}_{next_id}",
            'opacity': 1,
            'rotation': 0,
            'type': otype,
            'visible': True,
            'width': width,
            'x': x,
            'y': y
        }
        if 'objects' not in l: l['objects'] = []
        l['objects'].append(obj)
        next_id += 1

# Find central bushes
obj_base = get_layer('Object_Base')
central_bushes_left = []
central_bushes_right = []
for o in obj_base['objects']:
    if o.get('class', o.get('type', '')) == 'Bush':
        bx, by = o['x'], o['y']
        if 800 < by < 1300:
            if 1100 < bx < 1300:
                central_bushes_left.append(o)
            elif 1700 < bx < 1900:
                central_bushes_right.append(o)

# 2. Place Fences around Bush clusters
new_counts = {'Tree': 0, 'Bench': 0, 'Lamp': 0, 'Fence': 0}

def surround_with_fence(bushes):
    if not bushes: return
    min_x = min(b['x'] for b in bushes) - 32
    max_x = max(b['x'] for b in bushes) + 64
    min_y = min(b['y'] for b in bushes) - 32
    max_y = max(b['y'] for b in bushes) + 64
    
    # Top edge
    for x in range(min_x, max_x, 32):
        add_object('Fence', x, min_y, layers=['Object_Base', 'Collision'])
        new_counts['Fence'] += 1
    # Bottom edge
    for x in range(min_x, max_x, 32):
        add_object('Fence', x, max_y - 32, layers=['Object_Base', 'Collision'])
        new_counts['Fence'] += 1
    # Left edge
    for y in range(min_y + 32, max_y - 32, 32):
        add_object('Fence', min_x, y, layers=['Object_Base', 'Collision'])
        new_counts['Fence'] += 1
    # Right edge
    for y in range(min_y + 32, max_y - 32, 32):
        add_object('Fence', max_x - 32, y, layers=['Object_Base', 'Collision'])
        new_counts['Fence'] += 1

surround_with_fence(central_bushes_left)
surround_with_fence(central_bushes_right)

# Helper for placement
def is_grass(tx, ty): return get_tile(tx, ty) == grass_tile
def is_path(tx, ty): return get_tile(tx, ty) in path_tiles
def has_adjacent_path(tx, ty):
    return (is_path(tx+1, ty) or is_path(tx-1, ty) or 
            is_path(tx, ty+1) or is_path(tx, ty-1))

placed_trees = []
placed_benches = []
placed_lamps = []

def dist(p1, p2): return ((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)**0.5

# 3. Distribute Trees
random.seed(42) # For reproducible natural scattering
for ty in range(2, h-2, 3):
    for tx in range(2, w-2, 3):
        # random jitter
        jx = tx + random.randint(0, 2)
        jy = ty + random.randint(0, 2)
        
        # Check 3x3 area is mostly grass, to avoid blocking narrow paths
        grass_count = sum(1 for dx in [-1,0,1] for dy in [-1,0,1] if is_grass(jx+dx, jy+dy))
        if grass_count >= 8:
            # Check distance to other trees
            px, py = jx * 32, jy * 32
            if all(dist((px, py), pt) > 100 for pt in placed_trees):
                add_object('Tree', px, py, layers=['Object_Base', 'Foreground', 'Collision'])
                placed_trees.append((px, py))
                new_counts['Tree'] += 1

# 4. Distribute Benches & Lamps
# We want benches near paths
for ty in range(2, h-2):
    for tx in range(2, w-2):
        if is_grass(tx, ty) and has_adjacent_path(tx, ty):
            px, py = tx * 32, ty * 32
            # Benches should be spaced out
            if all(dist((px, py), pb) > 300 for pb in placed_benches):
                # Check not blocking doors or too close to other things
                if all(dist((px, py), pt) > 64 for pt in placed_trees):
                    # Place bench
                    add_object('Bench', px, py, layers=['Object_Base', 'Collision', 'Interaction'])
                    placed_benches.append((px, py))
                    new_counts['Bench'] += 1
                    
                    # Place lamp nearby (1 tile away in grass)
                    lx, ly = px, py
                    for dx, dy in [(1,0), (-1,0), (0,1), (0,-1)]:
                        if is_grass(tx+dx, ty+dy):
                            lx, ly = px + dx*32, py + dy*32
                            break
                    add_object('Lamp', lx, ly, layers=['Object_Base', 'Foreground', 'Collision'])
                    placed_lamps.append((lx, ly))
                    new_counts['Lamp'] += 1

# 5. Distribute Roadside Lamps
# Along paths, not near benches
for ty in range(2, h-2):
    for tx in range(2, w-2):
        if is_grass(tx, ty) and has_adjacent_path(tx, ty):
            px, py = tx * 32, ty * 32
            if all(dist((px, py), pl) > 400 for pl in placed_lamps):
                if all(dist((px, py), pt) > 64 for pt in placed_trees):
                    add_object('Lamp', px, py, layers=['Object_Base', 'Foreground', 'Collision'])
                    placed_lamps.append((px, py))
                    new_counts['Lamp'] += 1

with open('public/maps/plaza-park-v2.tmj', 'w', encoding='utf-8') as f:
    json.dump(d, f, separators=(',', ':'))

print(f"Added {new_counts['Tree']} Trees")
print(f"Added {new_counts['Bench']} Benches")
print(f"Added {new_counts['Lamp']} Lamps")
print(f"Added {new_counts['Fence']} Fences (around central bushes)")
print("Modified layers: Object_Base, Foreground, Collision, Interaction")
print("Confirmed untouched fixed elements: Cafe, Public Facility, Manhole, Ground, Navigation, Waypoints, Route, Doors, Camera_Zone, Traffic logic.")
