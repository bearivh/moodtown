import os, sys
from flask import Flask
from flask_cors import CORS
from db import init_db

# Ensure backend path for api package imports
sys.path.append(os.path.dirname(__file__))
from api.routes import register_all  # noqa: E402

app = Flask(__name__)
CORS(app)

# DB 초기화 및 라우트 등록
init_db()
register_all(app)

if __name__ == "__main__":
    app.run(debug=True)


