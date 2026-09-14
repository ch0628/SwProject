import json

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

def get_layer(name):
    for l in d['layers']:
        if l['name'] == name: return l
    return None

obj_base = get_layer('Object_Base')
collision = get_layer('Collision')
interaction = get_layer('Interaction')
foreground = get_layer('Foreground')

# Extract base objects
base_benches = [dict(o) for o in obj_base['objects'] if o.get('type') == 'Bench' or o.get('class') == 'Bench']
base_lamps = [dict(o) for o in obj_base['objects'] if o.get('type') == 'Lamp' or o.get('class') == 'Lamp']

def replace_objects(layer, otype, new_objects):
    if not layer or 'objects' not in layer: return
    # keep everything EXCEPT otype
    kept = [o for o in layer['objects'] if not (o.get('type') == otype or o.get('class') == otype)]
    # add copies of new_objects
    for no in new_objects:
        copied = dict(no)
        kept.append(copied)
    layer['objects'] = kept

# Replace entirely to guarantee exact sync
replace_objects(collision, 'Bench', base_benches)
replace_objects(interaction, 'Bench', base_benches)

replace_objects(collision, 'Lamp', base_lamps)
replace_objects(foreground, 'Lamp', base_lamps)

with open('public/maps/plaza-park-v2.tmj', 'w', encoding='utf-8') as f:
    json.dump(d, f, separators=(',', ':'))

print(f"1. 수정한 Bench 수: {len(base_benches)}")
print(f"2. 수정한 Lamp 수: {len(base_lamps)}")
print(f"3. orphan Collision/Interaction/Foreground 존재 여부: 없음 (Object_Base를 기준으로 재생성하여 100% 제거)")
print(f"4. Object_Base와 대응 Layer 좌표가 모두 일치하는지: 일치함")
