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

# Identify tile types
grass_tile = 2
path_tiles = {3, 4, 5, 6} # 5 is plaza, 3/6 are roads/paths
building_tiles = {1}

def get_tile(tx, ty):
    if tx < 0 or tx >= w or ty < 0 or ty >= h:
        return 0
    return ground[ty * w + tx]

# We need to remove Tree, Bench, Lamp, Fence from all object layers
layers_to_clean = ['Object_Base', 'Foreground', 'Collision', 'Interaction']
cleaned_counts = {'Tree': 0, 'Bench': 0, 'Lamp': 0, 'Fence': 0}

next_id = 1000

for lname in layers_to_clean:
    l = get_layer(lname)
    if not l or 'objects' not in l: continue
    
    new_objs = []
    for o in l['objects']:
        otype = o.get('class', o.get('type', ''))
        if otype in ['Tree', 'Bench', 'Lamp', 'Fence']:
            cleaned_counts[otype] += 1
            if o['id'] >= next_id: next_id = o['id'] + 1
        else:
            new_objs.append(o)
            if o['id'] >= next_id: next_id = o['id'] + 1
    l['objects'] = new_objs

print("Cleaned up existing objects:", cleaned_counts)

# Find the Central Plaza Bush
# Center of the map is x=1536, y=896
# Let's find bushes that are close to the center
bushes = []
obj_base = get_layer('Object_Base')
for o in obj_base['objects']:
    if o.get('class', o.get('type', '')) == 'Bush':
        bushes.append(o)

def dist(o, cx, cy):
    return ((o['x'] - cx)**2 + (o['y'] - cy)**2)**0.5

# Sort bushes by distance to center
bushes.sort(key=lambda o: dist(o, 1536, 896))

print("Closest bushes to center:")
for i in range(min(5, len(bushes))):
    print(f"  {bushes[i]['name']} at {bushes[i]['x']}, {bushes[i]['y']}")
