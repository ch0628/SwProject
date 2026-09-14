import json
from collections import Counter

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

print("Tileset mapping:")
for ts in d['tilesets']:
    if 'tiles' in ts:
        for t in ts['tiles']:
            t_id = t['id'] + ts['firstgid']
            class_name = t.get('class', t.get('type', ''))
            print(f"  GID {t_id}: class='{class_name}', props: {t.get('properties', [])}")

print("\nGround layer tiles:")
for l in d['layers']:
    if l['name'] == 'Ground' and l['type'] == 'tilelayer':
        counts = Counter(l['data'])
        print(f"  Ground uses tiles: {counts}")
        
    if l['name'] == 'Object_Base' and l['type'] == 'objectgroup':
        objs = l.get('objects', [])
        print(f"\nObject_Base has {len(objs)} objects:")
        classes = Counter([o.get('class', o.get('type', '')) for o in objs])
        print(f"  Classes: {classes}")
        for o in objs:
            if o.get('class', o.get('type', '')) in ['Bush', 'Bench', 'Lamp', 'Tree', 'Fence']:
                print(f"    {o.get('class', o.get('type', ''))}: {o.get('name', '')} at ({o['x']}, {o['y']}) gid={o.get('gid', 'None')}")
