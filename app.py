from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import os
import random
import math
from PIL import Image, ImageDraw, ImageFilter
import io
import base64
import hashlib
from datetime import datetime

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

DB_PATH = 'data/glazecraft.db'
UPLOAD_FOLDER = 'data/gallery'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT DEFAULT '陶艺家',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS pottery_works (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT DEFAULT '未命名作品',
        description TEXT,
        mesh_data TEXT,
        glaze_recipe TEXT,
        firing_params TEXT,
        texture_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS glaze_recipes (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        ingredients TEXT,
        temperature_min INTEGER,
        temperature_max INTEGER,
        difficulty TEXT,
        hint TEXT
    )
    ''')
    
    default_recipes = [
        {
            'id': 'recipe_001',
            'name': '青瓷釉',
            'description': '宋代龙泉窑经典釉色，温润如玉',
            'ingredients': json.dumps({
                '长石': 40, '石英': 25, '高岭土': 20, '草木灰': 10, '氧化铁': 5
            }),
            'temperature_min': 1200,
            'temperature_max': 1250,
            'difficulty': '简单',
            'hint': '氧化焰烧成，保持1200-1250度'
        },
        {
            'id': 'recipe_002',
            'name': '钧窑釉',
            'description': '入窑一色，出窑万彩',
            'ingredients': json.dumps({
                '长石': 35, '石英': 20, '方解石': 15, '草木灰': 10, 
                '氧化铜': 8, '五氧化二磷': 7, '氧化铁': 5
            }),
            'temperature_min': 1280,
            'temperature_max': 1320,
            'difficulty': '困难',
            'hint': '还原焰，窑变需要温度突变'
        },
        {
            'id': 'recipe_003',
            'name': '建盏油滴釉',
            'description': '兔毫纹与油滴结晶的艺术',
            'ingredients': json.dumps({
                '长石': 30, '石英': 15, '方解石': 15, '草木灰': 15,
                '氧化铁': 20, '锰矿': 5
            }),
            'temperature_min': 1300,
            'temperature_max': 1350,
            'difficulty': '专家',
            'hint': '高温还原，快速冷却产生结晶'
        }
    ]
    
    for recipe in default_recipes:
        cursor.execute('''
        INSERT OR REPLACE INTO glaze_recipes 
        (id, name, description, ingredients, temperature_min, temperature_max, difficulty, hint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            recipe['id'], recipe['name'], recipe['description'], 
            recipe['ingredients'], recipe['temperature_min'], 
            recipe['temperature_max'], recipe['difficulty'], recipe['hint']
        ))
    
    conn.commit()
    conn.close()

def generate_kiln_change_texture(firing_params, glaze_recipe, size=512):
    temp_profile = firing_params.get('temperature_profile', [])
    cooling_rate = firing_params.get('cooling_rate', 100)
    oxygen_level = firing_params.get('oxygen_level', 21)
    max_temp = max([t for t, _ in temp_profile]) if temp_profile else 1200
    
    recipe_ingredients = json.loads(glaze_recipe.get('ingredients', '{}'))
    
    img = Image.new('RGBA', (size, size), (200, 180, 150, 255))
    draw = ImageDraw.Draw(img)
    
    base_color = calculate_base_color(recipe_ingredients, max_temp, oxygen_level)
    
    for x in range(size):
        for y in range(size):
            noise = perlin_noise(x / 50, y / 50, random.randint(0, 1000))
            variation = int(noise * 30)
            color = (
                max(0, min(255, base_color[0] + variation)),
                max(0, min(255, base_color[1] + variation)),
                max(0, min(255, base_color[2] + variation)),
                255
            )
            draw.point((x, y), fill=color)
    
    crystallization_chance = calculate_crystallization_chance(temp_profile, recipe_ingredients)
    num_crystals = int(crystallization_chance * random.randint(5, 20))
    
    for _ in range(num_crystals):
        x = random.randint(0, size)
        y = random.randint(0, size)
        crystal_size = random.randint(5, 30)
        crystal_color = random.choice([
            (255, 215, 0), (255, 192, 203), (173, 216, 230),
            (144, 238, 144), (255, 165, 0), (128, 0, 128)
        ])
        
        draw_irregular_crystal(draw, x, y, crystal_size, crystal_color)
    
    if oxygen_level < 15 and max_temp > 1250:
        create_flow_effect(draw, size, cooling_rate)
    
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def calculate_base_color(ingredients, max_temp, oxygen_level):
    iron_content = ingredients.get('氧化铁', 0)
    copper_content = ingredients.get('氧化铜', 0)
    ash_content = ingredients.get('草木灰', 0)
    phosphor_content = ingredients.get('五氧化二磷', 0)
    
    r, g, b = 200, 180, 150
    
    if iron_content > 0:
        if oxygen_level < 15:
            r = min(255, r - iron_content * 2)
            g = min(255, g + iron_content * 1)
            b = min(255, b + iron_content * 3)
        else:
            r = min(255, r + iron_content * 3)
            g = min(255, g + iron_content * 1)
            b = min(255, b - iron_content * 1)
    
    if copper_content > 0:
        r = min(255, r - copper_content * 2)
        g = min(255, g + copper_content * 4)
        b = min(255, b + copper_content * 3)
    
    if ash_content > 0:
        r = min(255, r + ash_content * 1)
        g = min(255, g + ash_content * 1)
        b = min(255, b + ash_content * 1)
    
    if phosphor_content > 0:
        r = min(255, r + phosphor_content * 2)
        g = min(255, g - phosphor_content * 1)
        b = min(255, b + phosphor_content * 3)
    
    temp_factor = max_temp / 1300
    r = int(r * temp_factor)
    g = int(g * temp_factor)
    b = int(b * temp_factor)
    
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))

def calculate_crystallization_chance(temp_profile, ingredients):
    if not temp_profile or len(temp_profile) < 2:
        return 0.3
    
    max_temp = max([t for t, _ in temp_profile])
    cooling_start_idx = next((i for i, (t, _) in enumerate(temp_profile) if t == max_temp), 0)
    
    if cooling_start_idx >= len(temp_profile) - 1:
        return 0.3
    
    cooling_segment = temp_profile[cooling_start_idx:]
    if len(cooling_segment) < 2:
        return 0.3
    
    cooling_time = cooling_segment[-1][1] - cooling_segment[0][1]
    initial_temp = cooling_segment[0][0]
    final_temp = cooling_segment[-1][0]
    cooling_rate = (initial_temp - final_temp) / max(1, cooling_time)
    
    iron_content = ingredients.get('氧化铁', 0)
    manganese_content = ingredients.get('锰矿', 0)
    phosphor_content = ingredients.get('五氧化二磷', 0)
    
    chance = 0.1
    
    if cooling_rate > 50:
        chance += 0.3
    if cooling_rate > 100:
        chance += 0.2
    
    chance += iron_content * 0.02
    chance += manganese_content * 0.015
    chance += phosphor_content * 0.025
    
    if max_temp > 1280:
        chance += 0.15
    
    return min(1.0, max(0.0, chance))

def perlin_noise(x, y, seed):
    random.seed(seed + int(x) * 1000 + int(y))
    n = 0.0
    amplitude = 1.0
    frequency = 1.0
    
    for _ in range(4):
        n += noise_at(x * frequency, y * frequency) * amplitude
        amplitude *= 0.5
        frequency *= 2.0
    
    return n

def noise_at(x, y):
    xi = int(x)
    yi = int(y)
    
    xf = x - xi
    yf = y - yi
    
    v00 = hash_coord(xi, yi)
    v10 = hash_coord(xi + 1, yi)
    v01 = hash_coord(xi, yi + 1)
    v11 = hash_coord(xi + 1, yi + 1)
    
    u = fade(xf)
    v = fade(yf)
    
    x1 = lerp(v00, v10, u)
    x2 = lerp(v01, v11, u)
    
    return lerp(x1, x2, v)

def hash_coord(x, y):
    h = (x * 374761393 + y * 668265263) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    h = h ^ (h >> 16)
    return (h / 4294967296.0) * 2 - 1

def fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)

def lerp(a, b, t):
    return a + t * (b - a)

def draw_irregular_crystal(draw, x, y, size, color):
    points = []
    num_points = random.randint(5, 8)
    
    for i in range(num_points):
        angle = (i / num_points) * math.pi * 2
        distance = size * (0.5 + random.random() * 0.5)
        px = x + math.cos(angle) * distance
        py = y + math.sin(angle) * distance
        points.append((px, py))
    
    draw.polygon(points, fill=color, outline=tuple(c // 2 for c in color))

def create_flow_effect(draw, size, cooling_rate):
    flow_intensity = min(1.0, cooling_rate / 200)
    num_streaks = int(flow_intensity * random.randint(5, 15))
    
    for _ in range(num_streaks):
        start_x = random.randint(0, size)
        start_y = random.randint(0, size // 2)
        streak_length = random.randint(50, 200)
        streak_width = random.randint(2, 8)
        
        color = random.choice([
            (30, 60, 100), (80, 40, 20), (50, 50, 80), (20, 80, 60)
        ])
        
        draw.line(
            [(start_x, start_y), (start_x + random.randint(-20, 20), start_y + streak_length)],
            fill=color, width=streak_width
        )

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/recipes', methods=['GET'])
def get_recipes():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM glaze_recipes')
    recipes = []
    for row in cursor.fetchall():
        recipes.append({
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'ingredients': json.loads(row['ingredients']),
            'temperature_min': row['temperature_min'],
            'temperature_max': row['temperature_max'],
            'difficulty': row['difficulty'],
            'hint': row['hint']
        })
    conn.close()
    return jsonify(recipes)

@app.route('/api/recipes/<recipe_id>', methods=['GET'])
def get_recipe(recipe_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM glaze_recipes WHERE id = ?', (recipe_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'Recipe not found'}), 404
    
    return jsonify({
        'id': row['id'],
        'name': row['name'],
        'description': row['description'],
        'ingredients': json.loads(row['ingredients']),
        'temperature_min': row['temperature_min'],
        'temperature_max': row['temperature_max'],
        'difficulty': row['difficulty'],
        'hint': row['hint']
    })

@app.route('/api/works', methods=['POST'])
def save_work():
    data = request.json
    work_id = 'work_' + hashlib.md5(datetime.now().isoformat().encode()).hexdigest()[:12]
    user_id = data.get('user_id', 'anonymous')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO pottery_works 
    (id, user_id, name, description, mesh_data, glaze_recipe, firing_params, texture_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        work_id,
        user_id,
        data.get('name', '未命名作品'),
        data.get('description', ''),
        json.dumps(data.get('mesh_data', {})),
        json.dumps(data.get('glaze_recipe', {})),
        json.dumps(data.get('firing_params', {})),
        data.get('texture_data', '')
    ))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'id': work_id})

@app.route('/api/works/<work_id>', methods=['GET'])
def get_work(work_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM pottery_works WHERE id = ?', (work_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'Work not found'}), 404
    
    return jsonify({
        'id': row['id'],
        'user_id': row['user_id'],
        'name': row['name'],
        'description': row['description'],
        'mesh_data': json.loads(row['mesh_data']),
        'glaze_recipe': json.loads(row['glaze_recipe']),
        'firing_params': json.loads(row['firing_params']),
        'texture_data': row['texture_data'],
        'created_at': row['created_at']
    })

@app.route('/api/works/user/<user_id>', methods=['GET'])
def get_user_works(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT id, name, description, created_at, texture_data 
    FROM pottery_works 
    WHERE user_id = ? 
    ORDER BY created_at DESC
    ''', (user_id,))
    
    works = []
    for row in cursor.fetchall():
        works.append({
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'created_at': row['created_at'],
            'texture_data': row['texture_data']
        })
    conn.close()
    
    return jsonify(works)

@app.route('/api/firing/generate-texture', methods=['POST'])
def generate_texture():
    data = request.json
    firing_params = data.get('firing_params', {})
    glaze_recipe = data.get('glaze_recipe', {})
    
    texture = generate_kiln_change_texture(firing_params, glaze_recipe)
    
    return jsonify({
        'success': True,
        'texture': texture
    })

@app.route('/api/share/<work_id>', methods=['GET'])
def share_work(work_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM pottery_works WHERE id = ?', (work_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'Work not found'}), 404
    
    share_data = {
        'id': row['id'],
        'name': row['name'],
        'description': row['description'],
        'mesh_data': json.loads(row['mesh_data']),
        'glaze_recipe': json.loads(row['glaze_recipe']),
        'firing_params': json.loads(row['firing_params']),
        'texture_data': row['texture_data'],
        'share_url': f'/share/{work_id}'
    }
    
    return jsonify(share_data)

@app.route('/share/<work_id>')
def view_shared_work(work_id):
    return send_from_directory(app.static_folder, 'share.html')

if __name__ == '__main__':
    init_db()
    print("GlazeCraft: The Kiln Alchemy 正在启动...")
    print(f"端口: 2948")
    print(f"访问地址: http://localhost:2948")
    app.run(host='0.0.0.0', port=2948, debug=True)
