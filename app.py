from flask import Flask, render_template, request, redirect, url_for, flash
import os, json
from werkzeug.utils import secure_filename
from datetime import datetime

from models.db_manager import init_db, add_entry, get_entries, get_entry_by_id, delete_entry
from models.sentiment_model import analyze_diary
from utils.color_extractor import extract_palette

import sys, click

app = Flask(__name__)
# 업로드 실제 저장 폴더(절대경로)
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'uploads')
app.secret_key = 'moodpage-secret-key'

init_db()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/write', methods=['GET', 'POST'])
def write():
    if request.method == 'POST':
        date_str = request.form['date']
        content = request.form['content'].strip()
        image = request.files.get('image')

        abs_image_path = None   # 분석/팔레트 추출용 절대경로
        rel_image_path = None   # DB/웹표시용 상대경로 ('uploads/xxx.jpg')

        if image and image.filename:
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            filename = secure_filename(image.filename)
            abs_image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)         # 절대경로
            image.save(abs_image_path)
            rel_image_path = os.path.join('uploads', filename).replace('\\', '/')        # 상대경로

        # LLM 분석: 절대경로를 넘긴다 (이미지 캡션/사진무드용)
        analysis = analyze_diary(content, abs_image_path)

        # 팔레트 추출: 절대경로로 처리
        palette = extract_palette(abs_image_path) if abs_image_path else []

        # DB에는 상대경로 저장 (웹에서 바로 렌더 가능)
        add_entry(date_str, content, analysis, rel_image_path, palette)

        flash("저장 완료!")
        return redirect(url_for('archive'))

        # GET
    today = datetime.now().strftime("%Y-%m-%d")
    return render_template('write.html', today=today)

@app.route('/archive')
def archive():
    entries = get_entries()
    return render_template('archive.html', entries=entries)

@app.route('/mood/<int:entry_id>')
def mood_page(entry_id):
    entry = get_entry_by_id(entry_id)
    if not entry:
        return render_template('mood_page.html', entry=None)

    # entry: (0:id, 1:date, 2:content, 3:sentiment(JSON str), 4:photo(rel), 5:palette(JSON str))
    try:
        sentiment = json.loads(entry[3]) if entry[3] else {}
    except Exception:
        sentiment = {}

    try:
        palette = json.loads(entry[5]) if entry[5] else []
    except Exception:
        palette = []

    return render_template('mood_page.html', entry=entry, sentiment=sentiment, palette=palette)

@app.route('/delete/<int:entry_id>')
def delete(entry_id):
    delete_entry(entry_id)
    flash("삭제 완료")
    return redirect(url_for('archive'))

if __name__ == "__main__":
    os.environ["FLASK_RUN_FROM_CLI"] = "false"   # Windows 콘솔 이슈 회피
    app.run(debug=True, use_reloader=False)

def _safe_echo(message=None, nl=True, err=False, color=None, file=None):
    try:
        out = sys.__stderr__ if err else sys.__stdout__
        out.write(str(message) + ("\n" if nl else ""))
        out.flush()
    except Exception:
        pass
click.echo = _safe_echo

os.environ["FLASK_RUN_FROM_CLI"] = "false"
app.run(debug=True, use_reloader=False)
