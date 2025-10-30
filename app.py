from flask import Flask, render_template, request
from models.mood_analyzer import analyze_mood
from models.color_extractor import extract_palette
from models.vision_analyzer import analyze_image_mood
from utils.summarize import summarize_text
import os

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    diary_text = request.form.get('diary', '')
    image_file = request.files.get('image')

    image_path = None
    if image_file and image_file.filename:
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_file.filename)
        image_file.save(image_path)

    emotions, summary = analyze_mood(diary_text)

    if not summary:
        summary = summarize_text(diary_text)

    palette = extract_palette(image_path) if image_path else None

    image_mood = analyze_image_mood(image_path) if image_path else None
    
    return render_template('result.html',
                           summary=summary,
                           emotions=emotions,
                           palette=palette,
                           image_path=image_path)

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)

    