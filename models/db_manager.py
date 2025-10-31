import sqlite3, json, os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'moodpage.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # weather 제거된 최종 스키마
    c.execute('''
        CREATE TABLE IF NOT EXISTS diary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            content TEXT,
            sentiment TEXT,   -- JSON 문자열
            photo TEXT,       -- 웹표시용 상대경로 (예: 'uploads/xxx.jpg')
            palette TEXT      -- JSON 배열 ["#RRGGBB", ...]
        )
    ''')
    conn.commit()
    conn.close()

def add_entry(date_str, content, sentiment_dict, photo_relpath, palette_list):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        'INSERT INTO diary (date, content, sentiment, photo, palette) VALUES (?, ?, ?, ?, ?)',
        (
            date_str,
            content,
            json.dumps(sentiment_dict, ensure_ascii=False),
            photo_relpath,                           # 상대경로 저장
            json.dumps(palette_list, ensure_ascii=False)
        )
    )
    conn.commit()
    conn.close()

def get_entries():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # id, date, content, sentiment, photo, palette
    c.execute('SELECT id, date, content, sentiment, photo, palette FROM diary ORDER BY date DESC, id DESC')
    rows = c.fetchall()
    conn.close()
    return rows

def get_entry_by_id(entry_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, date, content, sentiment, photo, palette FROM diary WHERE id=?', (entry_id,))
    row = c.fetchone()
    conn.close()
    return row

def delete_entry(entry_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM diary WHERE id=?', (entry_id,))
    conn.commit()
    conn.close()
