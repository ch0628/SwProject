import json

with open('public/maps/plaza-park-v2.tmj', 'r', encoding='utf-8') as f:
    d = json.load(f)

print(f"Size: {d['width']}x{d['height']}")
print("Layers:")
for l in d['layers']:
    print(f"  {l['name']} (type: {l['type']}, id: {l['id']})")
    
print("Tilesets:")
for ts in d['tilesets']:
    print(f"  {ts['name']}: firstgid={ts['firstgid']}, source={ts.get('source')}")
