"""
SQLite 및 PostgreSQL 데이터베이스 모델 및 초기화
"""
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
import sqlite3

# PostgreSQL 지원
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    import psycopg2.errors
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    # psycopg2가 없을 때를 위한 더미 클래스
    class DummyErrors:
        class DuplicateColumn(Exception):
            pass
    psycopg2 = type('module', (), {'errors': DummyErrors()})()

# 데이터베이스 타입 감지
DATABASE_URL = os.environ.get('DATABASE_URL')
USE_POSTGRESQL_ENV = os.environ.get('USE_POSTGRESQL', '').lower() == 'true'

# PostgreSQL 자동 감지
# 1. DATABASE_URL이 있고 postgres를 포함하면 PostgreSQL 사용
# 2. 또는 USE_POSTGRESQL=true이고 DATABASE_URL이나 개별 PostgreSQL 환경 변수가 있으면 사용
USE_POSTGRESQL = False
if DATABASE_URL and 'postgres' in DATABASE_URL.lower():
    USE_POSTGRESQL = True
elif USE_POSTGRESQL_ENV:
    # USE_POSTGRESQL=true인 경우, DATABASE_URL이나 개별 환경 변수가 있어야 함
    if DATABASE_URL or (os.environ.get('PGHOST') and os.environ.get('PGDATABASE')):
        USE_POSTGRESQL = True
    else:
        # PostgreSQL 환경 변수가 없으면 SQLite 사용
        print("⚠️  USE_POSTGRESQL=true이지만 DATABASE_URL 또는 PostgreSQL 환경 변수가 없습니다. SQLite를 사용합니다.")

DB_PATH = os.path.join(os.path.dirname(__file__), 'moodtown.db')

def get_db_connection():
    """데이터베이스 연결 반환 (SQLite 또는 PostgreSQL)"""
    if USE_POSTGRESQL:
        if not PSYCOPG2_AVAILABLE:
            print("⚠️  psycopg2-binary가 설치되지 않았습니다. SQLite를 사용합니다.")
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            return conn
        
        try:
            # DATABASE_URL에서 연결 정보 파싱
            if DATABASE_URL:
                conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            elif os.environ.get('PGHOST') and os.environ.get('PGDATABASE'):
                # 개별 환경 변수 사용 (모두 있어야 함)
                conn = psycopg2.connect(
                    host=os.environ.get('PGHOST'),
                    port=os.environ.get('PGPORT', '5432'),
                    database=os.environ.get('PGDATABASE'),
                    user=os.environ.get('PGUSER', 'postgres'),
                    password=os.environ.get('PGPASSWORD', ''),
                    cursor_factory=RealDictCursor
                )
            else:
                # PostgreSQL 환경 변수가 없으면 SQLite로 폴백
                raise ValueError("PostgreSQL 연결 정보가 없습니다")
            return conn
        except Exception as e:
            # PostgreSQL 연결 실패 시 SQLite로 폴백
            print(f"⚠️  PostgreSQL 연결 실패: {e}")
            print("⚠️  SQLite를 사용합니다.")
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            return conn
    else:
        # SQLite 사용
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def execute_query(cursor, query: str, params: tuple = ()):
    """데이터베이스 타입에 따라 쿼리 실행 (플레이스홀더 변환)"""
    # PostgreSQL은 %s, SQLite는 ? 사용
    if USE_POSTGRESQL:
        # ? 를 %s로 변환 (단순 변환, 복잡한 쿼리는 주의 필요)
        query = query.replace('?', '%s')
        # INSERT OR REPLACE를 PostgreSQL 문법으로 변환
        if 'INSERT OR REPLACE' in query.upper():
            # PostgreSQL에서는 ON CONFLICT ... DO UPDATE 사용
            # 이는 각 쿼리에 따라 다르므로 복잡함
            # 일단 기본 쿼리 실행 (나중에 개별 함수에서 처리)
            query = query.replace('INSERT OR REPLACE', 'INSERT')
        cursor.execute(query, params)
    else:
        cursor.execute(query, params)

def init_db():
    """데이터베이스 초기화 및 테이블 생성"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 실제 연결 타입 확인 (PostgreSQL은 RealDictCursor를 사용)
    actual_db_type = "PostgreSQL" if hasattr(conn, 'cursor_factory') or isinstance(conn.__class__.__module__, str) and 'psycopg2' in conn.__class__.__module__ else "SQLite"
    # 더 확실한 방법: connection 객체의 타입 확인
    is_postgres = 'psycopg2' in str(type(conn)) or hasattr(conn, 'server_version')
    
    db_type = "PostgreSQL" if is_postgres else "SQLite"
    print(f"🔌 {db_type} 데이터베이스 연결 중...")
    
    # 사용자 테이블
    if is_actual_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name VARCHAR(255),
                created_at TEXT NOT NULL
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                created_at TEXT NOT NULL
            )
        ''')
    
    # 마이그레이션: 기존 email 컬럼을 username으로 변경 (있으면)
    try:
        if is_postgres:
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)")
        else:
            cursor.execute("ALTER TABLE users ADD COLUMN username TEXT")
        cursor.execute("UPDATE users SET username = email WHERE username IS NULL AND email IS NOT NULL")
    except (sqlite3.OperationalError, AttributeError):
        try:
            if hasattr(psycopg2, 'errors') and is_postgres:
                pass  # PostgreSQL의 경우 이미 처리됨
        except:
            pass  # 이미 username 컬럼이 있거나 마이그레이션이 완료된 경우
    
    # 일기 테이블
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS diaries (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                emotion_scores TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS diaries (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                emotion_scores TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
    
    # 기존 테이블에 user_id 컬럼 추가 (마이그레이션)
    try:
        if is_postgres:
            cursor.execute("ALTER TABLE diaries ADD COLUMN IF NOT EXISTS user_id INTEGER")
        else:
            cursor.execute("ALTER TABLE diaries ADD COLUMN user_id INTEGER")
        cursor.execute("UPDATE diaries SET user_id = 0 WHERE user_id IS NULL")
    except (sqlite3.OperationalError, AttributeError):
        pass
    
    # 광장 대화 테이블
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS plaza_conversations (
                date TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                conversation TEXT NOT NULL,
                emotion_scores TEXT,
                saved_at TEXT NOT NULL,
                PRIMARY KEY (date, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS plaza_conversations (
                date TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                conversation TEXT NOT NULL,
                emotion_scores TEXT,
                saved_at TEXT NOT NULL,
                PRIMARY KEY (date, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
    
    # 마이그레이션: 기존 plaza_conversations에 user_id 추가
    try:
        if is_postgres:
            cursor.execute("ALTER TABLE plaza_conversations ADD COLUMN IF NOT EXISTS user_id INTEGER")
        else:
            cursor.execute("ALTER TABLE plaza_conversations ADD COLUMN user_id INTEGER")
        cursor.execute("UPDATE plaza_conversations SET user_id = 0 WHERE user_id IS NULL")
    except (sqlite3.OperationalError, AttributeError):
        pass
    
    # 행복 나무 상태 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tree_state (
            user_id INTEGER PRIMARY KEY,
            growth INTEGER NOT NULL DEFAULT 0,
            stage TEXT NOT NULL DEFAULT 'seed',
            last_updated TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 스트레스 우물 상태 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS well_state (
            user_id INTEGER PRIMARY KEY,
            water_level INTEGER NOT NULL DEFAULT 0,
            is_overflowing INTEGER NOT NULL DEFAULT 0,
            last_overflow_date TEXT,
            last_updated TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 우체통 편지 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS letters (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            from_character TEXT NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 마이그레이션: letters에 user_id 추가
    try:
        if is_postgres:
            cursor.execute("ALTER TABLE letters ADD COLUMN IF NOT EXISTS user_id INTEGER")
        else:
            cursor.execute("ALTER TABLE letters ADD COLUMN user_id INTEGER")
        cursor.execute("UPDATE letters SET user_id = 0 WHERE user_id IS NULL")
    except (sqlite3.OperationalError, AttributeError):
        pass
    
    # 행복 열매 개수 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS happy_fruits (
            user_id INTEGER PRIMARY KEY,
            count INTEGER NOT NULL DEFAULT 0,
            last_updated TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    
    db_info = DATABASE_URL if is_postgres else DB_PATH
    print(f"✅ {db_type} 데이터베이스 초기화 완료: {db_info}")

# ===============================
# 사용자 관련 함수
# ===============================

def create_user(username: str, password: str, name: str = None) -> Optional[int]:
    """새 사용자 생성"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 비밀번호 해싱
        import hashlib
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        created_at = datetime.now().isoformat()
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO users (username, password, name, created_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            ''', (username, hashed_password, name, created_at))
            user_id = cursor.fetchone()['id']
        else:
            cursor.execute('''
                INSERT INTO users (username, password, name, created_at)
                VALUES (?, ?, ?, ?)
            ''', (username, hashed_password, name, created_at))
            user_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        return user_id
    except (sqlite3.IntegrityError if not USE_POSTGRESQL else psycopg2.IntegrityError):
        return None
    except Exception as e:
        print(f"사용자 생성 실패: {e}")
        return None

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """아이디로 사용자 찾기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT * FROM users WHERE username = %s', (username,))
        else:
            try:
                cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
            except sqlite3.OperationalError:
                cursor.execute('SELECT * FROM users WHERE email = ?', (username,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            user = dict(row)
            user['id'] = user['id']
            return user
        return None
    except Exception as e:
        print(f"사용자 조회 실패: {e}")
        return None

def verify_user_password(username: str, password: str) -> Optional[Dict[str, Any]]:
    """사용자 비밀번호 확인"""
    import hashlib
    user = get_user_by_username(username)
    if not user:
        return None
    
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    if user['password'] == hashed_password:
        user.pop('password', None)
        return user
    return None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """ID로 사용자 찾기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
        else:
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            user = dict(row)
            if 'username' not in user or not user.get('username'):
                if 'email' in user:
                    user['username'] = user['email']
            return user
        return None
    except Exception as e:
        print(f"사용자 조회 실패: {e}")
        return None

# ===============================
# 일기 관련 함수
# ===============================

def save_diary(diary: Dict[str, Any], user_id: int = None) -> bool:
    """일기 저장"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        diary_id = diary.get('id') or str(int(datetime.now().timestamp() * 1000))
        date = diary.get('date') or datetime.now().strftime('%Y-%m-%d')
        title = diary.get('title', '')
        content = diary.get('content', '')
        emotion_data = {
            'emotion_scores': diary.get('emotion_scores', {}),
            'emotion_polarity': diary.get('emotion_polarity', {})
        }
        emotion_scores = json.dumps(emotion_data, ensure_ascii=False)
        created_at = diary.get('createdAt') or datetime.now().isoformat()
        updated_at = datetime.now().isoformat()
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO diaries 
                (id, user_id, date, title, content, emotion_scores, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    date = EXCLUDED.date,
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    emotion_scores = EXCLUDED.emotion_scores,
                    updated_at = EXCLUDED.updated_at
            ''', (diary_id, user_id, date, title, content, emotion_scores, created_at, updated_at))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO diaries 
                (id, user_id, date, title, content, emotion_scores, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (diary_id, user_id, date, title, content, emotion_scores, created_at, updated_at))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"일기 저장 실패: {e}")
        return False

def get_all_diaries(user_id: int = None) -> List[Dict[str, Any]]:
    """모든 일기 가져오기 (user_id가 있으면 필터링)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            if user_id is not None:
                cursor.execute('SELECT * FROM diaries WHERE user_id = %s ORDER BY created_at DESC', (user_id,))
            else:
                cursor.execute('SELECT * FROM diaries ORDER BY created_at DESC')
        else:
            if user_id is not None:
                cursor.execute('SELECT * FROM diaries WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
            else:
                cursor.execute('SELECT * FROM diaries ORDER BY created_at DESC')
        
        rows = cursor.fetchall()
        conn.close()
        
        diaries = []
        for row in rows:
            diary = dict(row)
            emotion_data = json.loads(diary['emotion_scores'] or '{}')
            if isinstance(emotion_data, dict) and 'emotion_scores' in emotion_data:
                diary['emotion_scores'] = emotion_data.get('emotion_scores', {})
                diary['emotion_polarity'] = emotion_data.get('emotion_polarity', {})
            else:
                diary['emotion_scores'] = emotion_data
                diary['emotion_polarity'] = {}
            diaries.append(diary)
        return diaries
    except Exception as e:
        print(f"일기 불러오기 실패: {e}")
        return []

def get_diaries_by_date(date: str, user_id: int = None) -> List[Dict[str, Any]]:
    """특정 날짜의 일기 가져오기 (user_id가 있으면 필터링)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            if user_id is not None:
                cursor.execute('SELECT * FROM diaries WHERE date = %s AND user_id = %s ORDER BY created_at DESC', (date, user_id))
            else:
                cursor.execute('SELECT * FROM diaries WHERE date = %s ORDER BY created_at DESC', (date,))
        else:
            if user_id is not None:
                cursor.execute('SELECT * FROM diaries WHERE date = ? AND user_id = ? ORDER BY created_at DESC', (date, user_id))
            else:
                cursor.execute('SELECT * FROM diaries WHERE date = ? ORDER BY created_at DESC', (date,))
        
        rows = cursor.fetchall()
        conn.close()
        
        diaries = []
        for row in rows:
            diary = dict(row)
            emotion_data = json.loads(diary['emotion_scores'] or '{}')
            if isinstance(emotion_data, dict) and 'emotion_scores' in emotion_data:
                diary['emotion_scores'] = emotion_data.get('emotion_scores', {})
                diary['emotion_polarity'] = emotion_data.get('emotion_polarity', {})
            else:
                diary['emotion_scores'] = emotion_data
                diary['emotion_polarity'] = {}
            diaries.append(diary)
        return diaries
    except Exception as e:
        print(f"일기 불러오기 실패: {e}")
        return []

def get_diary_by_id(diary_id: str) -> Optional[Dict[str, Any]]:
    """특정 ID의 일기 가져오기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT * FROM diaries WHERE id = %s', (diary_id,))
        else:
            cursor.execute('SELECT * FROM diaries WHERE id = ?', (diary_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            diary = dict(row)
            emotion_data = json.loads(diary['emotion_scores'] or '{}')
            if isinstance(emotion_data, dict) and 'emotion_scores' in emotion_data:
                diary['emotion_scores'] = emotion_data.get('emotion_scores', {})
                diary['emotion_polarity'] = emotion_data.get('emotion_polarity', {})
            else:
                diary['emotion_scores'] = emotion_data
                diary['emotion_polarity'] = {}
            return diary
        return None
    except Exception as e:
        print(f"일기 불러오기 실패: {e}")
        return None

def delete_diary(diary_id: str) -> bool:
    """일기 삭제"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('DELETE FROM diaries WHERE id = %s', (diary_id,))
        else:
            cursor.execute('DELETE FROM diaries WHERE id = ?', (diary_id,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"일기 삭제 실패: {e}")
        return False

# ===============================
# 광장 대화 관련 함수
# ===============================

def save_plaza_conversation(date: str, conversation: List[Dict], emotion_scores: Dict, user_id: int = None) -> bool:
    """광장 대화 저장"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        conversation_json = json.dumps(conversation, ensure_ascii=False)
        emotion_scores_json = json.dumps(emotion_scores, ensure_ascii=False)
        saved_at = datetime.now().isoformat()
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO plaza_conversations 
                (date, user_id, conversation, emotion_scores, saved_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (date, user_id) DO UPDATE SET
                    conversation = EXCLUDED.conversation,
                    emotion_scores = EXCLUDED.emotion_scores,
                    saved_at = EXCLUDED.saved_at
            ''', (date, user_id, conversation_json, emotion_scores_json, saved_at))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO plaza_conversations 
                (date, user_id, conversation, emotion_scores, saved_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (date, user_id, conversation_json, emotion_scores_json, saved_at))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"대화 저장 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_plaza_conversation_by_date(date: str, user_id: int = None) -> Optional[Dict[str, Any]]:
    """특정 날짜의 광장 대화 가져오기"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT * FROM plaza_conversations WHERE date = %s AND user_id = %s', (date, user_id))
        else:
            cursor.execute('SELECT * FROM plaza_conversations WHERE date = ? AND user_id = ?', (date, user_id))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            result = dict(row)
            try:
                result['conversation'] = json.loads(result.get('conversation') or '[]')
            except (json.JSONDecodeError, TypeError):
                result['conversation'] = []
            
            try:
                result['emotionScores'] = json.loads(result.get('emotion_scores') or '{}')
            except (json.JSONDecodeError, TypeError):
                result['emotionScores'] = {}
            
            return result
        return None
    except Exception as e:
        print(f"대화 불러오기 실패: {e}")
        import traceback
        traceback.print_exc()
        return None

def delete_plaza_conversation_by_date(date: str) -> bool:
    """특정 날짜의 광장 대화 삭제"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('DELETE FROM plaza_conversations WHERE date = %s', (date,))
        else:
            cursor.execute('DELETE FROM plaza_conversations WHERE date = ?', (date,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"대화 삭제 실패: {e}")
        return False

def delete_diary_by_date(date: str) -> bool:
    """특정 날짜의 일기 삭제 (날짜별)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('DELETE FROM diaries WHERE date = %s', (date,))
        else:
            cursor.execute('DELETE FROM diaries WHERE date = ?', (date,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"일기 삭제 실패: {e}")
        return False

# ===============================
# 행복 나무 관련 함수
# ===============================

def get_tree_state(user_id: int = None) -> Dict[str, Any]:
    """행복 나무 상태 가져오기 (성장도에 맞는 단계 자동 계산)"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT * FROM tree_state WHERE user_id = %s', (user_id,))
        else:
            cursor.execute('SELECT * FROM tree_state WHERE user_id = ?', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        stage_thresholds = [0, 40, 100, 220, 380, 600]
        
        if row:
            state = dict(row)
            growth = int(state.get('growth', 0))
            
            calculated_stage = 0
            for i in range(len(stage_thresholds) - 1, -1, -1):
                if growth >= stage_thresholds[i]:
                    calculated_stage = i
                    break
            
            stored_stage = state.get('stage', 0)
            if isinstance(stored_stage, str):
                stage_map = {
                    'seed': 0, 'sprout': 1, 'small': 2, 'seedling': 2,
                    'medium': 3, 'large': 4, 'fruit': 5
                }
                stored_stage = stage_map.get(stored_stage.lower(), 0)
            stored_stage = int(stored_stage)
            
            if stored_stage != calculated_stage:
                state['stage'] = calculated_stage
                state['growth'] = growth
                save_tree_state(state, user_id)
                print(f"나무 단계 자동 수정: {stored_stage} -> {calculated_stage} (성장도: {growth})")
            
            state['stage'] = calculated_stage
            state['growth'] = growth
            return state
        else:
            now = datetime.now().isoformat()
            default_state = {
                'growth': 0,
                'stage': 0,
                'last_updated': now
            }
            save_tree_state(default_state, user_id)
            return default_state
    except Exception as e:
        print(f"나무 상태 불러오기 실패: {e}")
        import traceback
        traceback.print_exc()
        return {'growth': 0, 'stage': 0, 'last_updated': datetime.now().isoformat()}

def save_tree_state(state: Dict[str, Any], user_id: int = None) -> bool:
    """행복 나무 상태 저장"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        state['last_updated'] = datetime.now().isoformat()
        
        stage = state.get('stage', 0)
        if isinstance(stage, str):
            stage_map = {
                'seed': 0, 'sprout': 1, 'small': 2, 
                'medium': 3, 'large': 4, 'fruit': 5
            }
            stage = stage_map.get(stage.lower(), 0)
        stage = int(stage)
        growth = int(state.get('growth', 0))
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO tree_state (user_id, growth, stage, last_updated)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    growth = EXCLUDED.growth,
                    stage = EXCLUDED.stage,
                    last_updated = EXCLUDED.last_updated
            ''', (user_id, growth, stage, state['last_updated']))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO tree_state 
                (user_id, growth, stage, last_updated)
                VALUES (?, ?, ?, ?)
            ''', (user_id, growth, stage, state['last_updated']))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"나무 상태 저장 실패: {e}")
        return False

def get_happy_fruit_count(user_id: int = None) -> int:
    """행복 열매 개수 가져오기"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT count FROM happy_fruits WHERE user_id = %s', (user_id,))
        else:
            cursor.execute('SELECT count FROM happy_fruits WHERE user_id = ?', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)['count']
        else:
            save_happy_fruit_count(0, user_id)
            return 0
    except Exception as e:
        print(f"열매 개수 불러오기 실패: {e}")
        return 0

def save_happy_fruit_count(count: int, user_id: int = None) -> bool:
    """행복 열매 개수 저장"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO happy_fruits (user_id, count, last_updated)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    count = EXCLUDED.count,
                    last_updated = EXCLUDED.last_updated
            ''', (user_id, count, now))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO happy_fruits 
                (user_id, count, last_updated)
                VALUES (?, ?, ?)
            ''', (user_id, count, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"열매 개수 저장 실패: {e}")
        return False

# ===============================
# 스트레스 우물 관련 함수
# ===============================

def get_well_state(user_id: int = None) -> Dict[str, Any]:
    """스트레스 우물 상태 가져오기"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            cursor.execute('SELECT * FROM well_state WHERE user_id = %s', (user_id,))
        else:
            cursor.execute('SELECT * FROM well_state WHERE user_id = ?', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            state = dict(row)
            state['isOverflowing'] = bool(state['is_overflowing'])
            return state
        else:
            now = datetime.now().isoformat()
            default_state = {
                'waterLevel': 0,
                'isOverflowing': False,
                'is_overflowing': 0,
                'lastOverflowDate': None,
                'last_overflow_date': None,
                'last_updated': now
            }
            save_well_state(default_state, user_id)
            return default_state
    except Exception as e:
        print(f"우물 상태 불러오기 실패: {e}")
        return {
            'waterLevel': 0, 
            'isOverflowing': False, 
            'lastOverflowDate': None,
            'last_updated': datetime.now().isoformat()
        }

def save_well_state(state: Dict[str, Any], user_id: int = None) -> bool:
    """스트레스 우물 상태 저장"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        state['last_updated'] = datetime.now().isoformat()
        is_overflowing = 1 if state.get('isOverflowing', False) else 0
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO well_state 
                (user_id, water_level, is_overflowing, last_overflow_date, last_updated)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    water_level = EXCLUDED.water_level,
                    is_overflowing = EXCLUDED.is_overflowing,
                    last_overflow_date = EXCLUDED.last_overflow_date,
                    last_updated = EXCLUDED.last_updated
            ''', (
                user_id,
                state.get('waterLevel', 0),
                is_overflowing,
                state.get('lastOverflowDate'),
                state['last_updated']
            ))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO well_state 
                (user_id, water_level, is_overflowing, last_overflow_date, last_updated)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                user_id,
                state.get('waterLevel', 0),
                is_overflowing,
                state.get('lastOverflowDate'),
                state['last_updated']
            ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"우물 상태 저장 실패: {e}")
        return False

# ===============================
# 우체통 편지 관련 함수
# ===============================

def save_letter(letter: Dict[str, Any], user_id: int = None) -> bool:
    """편지 저장"""
    try:
        if user_id is None:
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        letter_id = letter.get('id') or str(int(datetime.now().timestamp() * 1000))
        title = letter.get('title', '')
        content = letter.get('content', '')
        from_character = letter.get('from', '')
        letter_type = letter.get('type', '')
        date = letter.get('date') or datetime.now().strftime('%Y-%m-%d')
        is_read = 1 if letter.get('isRead', False) else 0
        created_at = letter.get('createdAt') or datetime.now().isoformat()
        
        if USE_POSTGRESQL:
            cursor.execute('''
                INSERT INTO letters 
                (id, user_id, title, content, from_character, type, date, is_read, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (letter_id, user_id, title, content, from_character, letter_type, date, is_read, created_at))
        else:
            cursor.execute('''
                INSERT INTO letters 
                (id, user_id, title, content, from_character, type, date, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (letter_id, user_id, title, content, from_character, letter_type, date, is_read, created_at))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"편지 저장 실패: {e}")
        return False

def get_all_letters(user_id: int = None) -> List[Dict[str, Any]]:
    """모든 편지 가져오기 (user_id가 있으면 필터링)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            if user_id is not None:
                cursor.execute('SELECT * FROM letters WHERE user_id = %s ORDER BY created_at DESC', (user_id,))
            else:
                cursor.execute('SELECT * FROM letters ORDER BY created_at DESC')
        else:
            if user_id is not None:
                cursor.execute('SELECT * FROM letters WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
            else:
                cursor.execute('SELECT * FROM letters ORDER BY created_at DESC')
        
        rows = cursor.fetchall()
        conn.close()
        
        letters = []
        for row in rows:
            letter = dict(row)
            letter['from'] = letter.pop('from_character')
            letter['isRead'] = bool(letter['is_read'])
            letter['createdAt'] = letter['created_at']
            letters.append(letter)
        return letters
    except Exception as e:
        print(f"편지 불러오기 실패: {e}")
        return []

def mark_letter_as_read(letter_id: str, user_id: int = None) -> bool:
    """편지 읽음 표시"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            if user_id is not None:
                cursor.execute('UPDATE letters SET is_read = 1 WHERE id = %s AND user_id = %s', (letter_id, user_id))
            else:
                cursor.execute('UPDATE letters SET is_read = 1 WHERE id = %s', (letter_id,))
        else:
            if user_id is not None:
                cursor.execute('UPDATE letters SET is_read = 1 WHERE id = ? AND user_id = ?', (letter_id, user_id))
            else:
                cursor.execute('UPDATE letters SET is_read = 1 WHERE id = ?', (letter_id,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"편지 읽음 표시 실패: {e}")
        return False

def delete_letter(letter_id: str, user_id: int = None) -> bool:
    """편지 삭제"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            if user_id is not None:
                cursor.execute('DELETE FROM letters WHERE id = %s AND user_id = %s', (letter_id, user_id))
            else:
                cursor.execute('DELETE FROM letters WHERE id = %s', (letter_id,))
        else:
            if user_id is not None:
                cursor.execute('DELETE FROM letters WHERE id = ? AND user_id = ?', (letter_id, user_id))
            else:
                cursor.execute('DELETE FROM letters WHERE id = ?', (letter_id,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"편지 삭제 실패: {e}")
        return False

def get_unread_letter_count(user_id: int = None) -> int:
    """읽지 않은 편지 개수"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if USE_POSTGRESQL:
            if user_id is not None:
                cursor.execute('SELECT COUNT(*) as count FROM letters WHERE is_read = 0 AND user_id = %s', (user_id,))
            else:
                cursor.execute('SELECT COUNT(*) as count FROM letters WHERE is_read = 0')
        else:
            if user_id is not None:
                cursor.execute('SELECT COUNT(*) as count FROM letters WHERE is_read = 0 AND user_id = ?', (user_id,))
            else:
                cursor.execute('SELECT COUNT(*) as count FROM letters WHERE is_read = 0')
        
        row = cursor.fetchone()
        conn.close()
        return dict(row)['count'] if row else 0
    except Exception as e:
        print(f"읽지 않은 편지 개수 불러오기 실패: {e}")
        return 0
