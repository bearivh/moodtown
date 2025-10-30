from flask import Flask, render_template, request, redirect, url_for
import os
from models.db_manager import init_db, add_entry, get_entries, get_entry_by_id, delete_entry
from models.sentiment_model import analyze_diary
from utils.color_extractor import extract_palette
from datetime import datetime
import json

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.secret_key = 'moodpage-secret-key'

# DB 초기화
init_db()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/write', methods=['GET', 'POST'])
def write():
    if request.method == 'POST':
        date_str = request.form['date']
        content = request.form['content']
        image = request.files.get('image')

        image_path = None
        if image and image.filename:
            filename = image.filename
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(image_path)

        analysis = analyze_diary(content)

        palette = extract_palette(image_path) if image_path else []

        add_entry(date_str, content, analysis, image_path, palette)
        return redirect(url_for('archive'))

    # 기본값: 오늘 날짜를 미리 보여주기
    today = datetime.now().strftime("%Y-%m-%d")
    return render_template('write.html', today=today)

@app.route('/archive')
def archive():
    entries = get_entries()
    return render_template('archive.html', entries=entries)

@app.route('/mood/<int:entry_id>')
@app.route('/mood/<int:entry_id>')
def mood_page(entry_id):
    entry = get_entry_by_id(entry_id)

    if not entry:
        return render_template('mood_page.html', entry=None)

    # entry 구조: (id, date, content, weather, sentiment, photo, palette)
    try:
        sentiment = json.loads(entry[3])
    except Exception:
        sentiment = {}

    try:
        palette = json.loads(entry[5]) if entry[5] else []
    except Exception:
        palette = []

    return render_template(
        'mood_page.html',
        entry=entry,
        sentiment=sentiment,
        palette=palette
    )

@app.route('/delete/<int:entry_id>')
def delete(entry_id):
    delete_entry(entry_id)
    return redirect(url_for('archive'))

if __name__ == '__main__':
    os.environ['FLASK_RUN_FROM_CLI'] = 'false'
    app.run(debug=True)
