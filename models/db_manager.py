import sqlite3, json

DB_PATH = 'moodpage.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS diary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            content TEXT,
            sentiment TEXT,
            photo TEXT,
            palette TEXT
        )
    ''')
    conn.commit()
    conn.close()


def add_entry(date_str, content, sentiment, photo, palette):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO diary VALUES (NULL, ?, ?, ?, ?, ?)', (
        date_str,
        content,
        json.dumps(sentiment, ensure_ascii=False),
        photo,
        json.dumps(palette)
    ))
    conn.commit()
    conn.close()


def get_entries():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, date, sentiment, photo FROM diary ORDER BY id DESC')
    rows = c.fetchall()
    conn.close()
    return rows


def get_entry_by_id(entry_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT * FROM diary WHERE id=?', (entry_id,))
    data = c.fetchone()
    conn.close()
    return data


def delete_entry(entry_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM diary WHERE id=?', (entry_id,))
    conn.commit()
    conn.close()