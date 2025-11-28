"""
PostgreSQL 전용 데이터베이스 모델 (for Deployment)

SQLite 제거 / 간결 / 안정성 개선
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import errors as pg_errors
from datetime import datetime
from typing import Dict, Any, Optional, List
import hashlib

# =========================================
# PostgreSQL 연결 준비
# =========================================

DATABASE_URL = os.environ.get("DATABASE_URL")

# 개별 환경 변수로부터 DATABASE_URL 구성 (DATABASE_URL이 없고 개별 변수가 있는 경우)
if not DATABASE_URL:
    PGHOST = os.environ.get("PGHOST")
    PGPORT = os.environ.get("PGPORT", "5432")
    PGDATABASE = os.environ.get("PGDATABASE")
    PGUSER = os.environ.get("PGUSER")
    PGPASSWORD = os.environ.get("PGPASSWORD")
    
    if all([PGHOST, PGDATABASE, PGUSER, PGPASSWORD]):
        # 공개 호스트명 사용 (railway.internal이 아닌)
        DATABASE_URL = f"postgresql://{PGUSER}:{PGPASSWORD}@{PGHOST}:{PGPORT}/{PGDATABASE}"
        print(f"🔍 개별 환경 변수로부터 DATABASE_URL 구성: {PGUSER}@{PGHOST}:{PGPORT}/{PGDATABASE}")
    else:
        print("❌ DATABASE_URL 환경변수가 없습니다. Railway/Render에서 반드시 설정하세요.")
        print(f"   개별 변수 상태: PGHOST={bool(PGHOST)}, PGDATABASE={bool(PGDATABASE)}, PGUSER={bool(PGUSER)}, PGPASSWORD={bool(PGPASSWORD)}")

# DATABASE_URL이 railway.internal을 포함하는 경우, 개별 환경 변수 사용 시도
if DATABASE_URL and "railway.internal" in DATABASE_URL:
    print("⚠️  railway.internal 호스트명 감지됨. 공개 호스트명으로 전환 시도...")
    PGHOST = os.environ.get("PGHOST")
    PGPORT = os.environ.get("PGPORT", "5432")
    PGDATABASE = os.environ.get("PGDATABASE")
    PGUSER = os.environ.get("PGUSER")
    PGPASSWORD = os.environ.get("PGPASSWORD")
    
    if all([PGHOST, PGDATABASE, PGUSER, PGPASSWORD]) and "railway.internal" not in PGHOST:
        # 공개 호스트명으로 재구성
        DATABASE_URL = f"postgresql://{PGUSER}:{PGPASSWORD}@{PGHOST}:{PGPORT}/{PGDATABASE}"
        print(f"✅ 공개 호스트명으로 전환: {PGUSER}@{PGHOST}:{PGPORT}/{PGDATABASE}")
    else:
        print("⚠️  공개 호스트명을 찾을 수 없습니다. railway.internal 사용을 계속 시도합니다.")

# sslmode 자동 추가
if DATABASE_URL and "sslmode" not in DATABASE_URL:
    DATABASE_URL += ("&sslmode=require" if "?" in DATABASE_URL else "?sslmode=require")

if DATABASE_URL:
    # 민감한 정보 숨기기
    url_preview = DATABASE_URL.split('@')[0] if '@' in DATABASE_URL else DATABASE_URL
    host_info = DATABASE_URL.split('@')[1].split('/')[0] if '@' in DATABASE_URL else '***'
    print(f"🔍 DATABASE_URL 설정됨: {url_preview}@{host_info.split(':')[0] if ':' in host_info else '***'}:{host_info.split(':')[1] if ':' in host_info else '***'}")

def get_db():
    """PostgreSQL 연결 객체 반환"""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL이 설정되지 않았습니다.")
    
    try:
        # 연결 타임아웃 설정 (5초)
        conn = psycopg2.connect(
            DATABASE_URL, 
            cursor_factory=RealDictCursor,
            connect_timeout=5  # 5초 타임아웃
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"⚠️  PostgreSQL 연결 실패 (운영 오류): {e}")
        print(f"🔍 연결 시도한 DATABASE_URL: {DATABASE_URL.split('@')[0] if '@' in DATABASE_URL else 'N/A'}@***")
        raise
    except Exception as e:
        print(f"⚠️  PostgreSQL 연결 실패: {e}")
        print(f"🔍 연결 시도한 DATABASE_URL: {DATABASE_URL.split('@')[0] if '@' in DATABASE_URL else 'N/A'}@***")
        raise

# =========================================
# 날짜 파싱 안전 함수
# =========================================

def parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        value = value.replace("Z", "+00:00")
        return datetime.fromisoformat(value)
    except:
        return datetime.now()  # fallback

# =========================================
# 초기화 함수
# =========================================

def init_db():
    if not DATABASE_URL:
        raise RuntimeError("❌ DATABASE_URL 환경변수가 없습니다. Railway/Render에서 반드시 설정하세요.")
    
    try:
        conn = get_db()
    except Exception as e:
        print(f"❌ PostgreSQL 연결 실패: {e}")
        raise RuntimeError(f"PostgreSQL 연결에 실패했습니다: {e}")
    
    cur = conn.cursor()
    
    print("🔌 PostgreSQL 데이터베이스 연결 중...")
    
    # Users
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name VARCHAR(255),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    
    # Diaries
    cur.execute("""
        CREATE TABLE IF NOT EXISTS diaries (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            emotion_scores JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP
        )
    """)
    
    # Plaza
    cur.execute("""
        CREATE TABLE IF NOT EXISTS plaza_conversations (
            date TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id),
            conversation JSONB,
            emotion_scores JSONB,
            saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
            PRIMARY KEY(date, user_id)
        )
    """)
    
    # Tree
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tree_state (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            growth INTEGER NOT NULL DEFAULT 0,
            stage INTEGER NOT NULL DEFAULT 0,
            last_updated TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    
    # Well
    cur.execute("""
        CREATE TABLE IF NOT EXISTS well_state (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            water_level INTEGER NOT NULL DEFAULT 0,
            is_overflowing BOOLEAN NOT NULL DEFAULT FALSE,
            last_overflow_date TEXT,
            last_updated TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    
    # Letters
    cur.execute("""
        CREATE TABLE IF NOT EXISTS letters (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            from_character TEXT NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    
    # Happy fruits
    cur.execute("""
        CREATE TABLE IF NOT EXISTS happy_fruits (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            count INTEGER NOT NULL DEFAULT 0,
            last_updated TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    
    conn.commit()
    
    # 테이블 생성 확인
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [row['table_name'] for row in cur.fetchall()]
    print(f"📊 생성된 테이블: {', '.join(tables) if tables else '(없음)'}")
    
    conn.close()
    
    db_info = DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else '(PostgreSQL)'
    print(f"✅ PostgreSQL 데이터베이스 초기화 완료: {db_info}")

# =========================================
# User Functions
# =========================================

def create_user(username: str, password: str, name: str = None) -> Optional[int]:
    try:
        conn = get_db()
        cur = conn.cursor()
        hashed = hashlib.sha256(password.encode()).hexdigest()
        cur.execute("""
            INSERT INTO users (username, password, name)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (username, hashed, name))
        user_id = cur.fetchone()['id']
        conn.commit()
        conn.close()
        return user_id
    except pg_errors.UniqueViolation:
        return None
    except Exception as e:
        print("사용자 생성 실패:", e)
        return None

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def verify_user_password(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_username(username)
    if not user:
        return None
    hashed = hashlib.sha256(password.encode()).hexdigest()
    if user["password"] == hashed:
        user.pop("password", None)
        return user
    return None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """ID로 사용자 찾기"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        user = dict(row)
        if 'username' not in user or not user.get('username'):
            if 'email' in user:
                user['username'] = user['email']
        return user
    return None

# =========================================
# Diary Functions
# =========================================

def save_diary(diary: Dict[str, Any], user_id: int = None) -> bool:
    """일기 저장 (user_id가 None이면 0 사용)"""
    if user_id is None:
        user_id = 0
    
    try:
        conn = get_db()
        cur = conn.cursor()
        
        diary_id = diary.get("id") or str(int(datetime.now().timestamp() * 1000))
        emotion_data = {
            "emotion_scores": diary.get("emotion_scores", {}),
            "emotion_polarity": diary.get("emotion_polarity", {})
        }
        
        cur.execute("""
            INSERT INTO diaries (id, user_id, date, title, content, emotion_scores, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                date = EXCLUDED.date,
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                emotion_scores = EXCLUDED.emotion_scores,
                updated_at = NOW()
        """, (
            diary_id,
            user_id,
            diary.get("date"),
            diary.get("title"),
            diary.get("content"),
            json.dumps(emotion_data, ensure_ascii=False),
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print("일기 저장 실패:", e)
        return False

def get_all_diaries(user_id: int = None) -> List[Dict[str, Any]]:
    """모든 일기 가져오기 (user_id가 있으면 필터링)"""
    conn = get_db()
    cur = conn.cursor()
    
    if user_id is not None:
        cur.execute("SELECT * FROM diaries WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    else:
        cur.execute("SELECT * FROM diaries ORDER BY created_at DESC")
    
    rows = cur.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        diary = dict(row)
        data = diary.get("emotion_scores") or {}
        diary["emotion_scores"] = data.get("emotion_scores", {})
        diary["emotion_polarity"] = data.get("emotion_polarity", {})
        
        # ISO 형식으로 변환
        if 'created_at' in diary and diary['created_at']:
            if isinstance(diary['created_at'], datetime):
                diary['createdAt'] = diary['created_at'].isoformat()
            else:
                diary['createdAt'] = str(diary['created_at'])
        
        result.append(diary)
    return result

def get_diaries_by_date(date: str, user_id: int = None) -> List[Dict[str, Any]]:
    """특정 날짜의 일기 가져오기 (user_id가 있으면 필터링)"""
    conn = get_db()
    cur = conn.cursor()
    
    if user_id is not None:
        cur.execute("SELECT * FROM diaries WHERE user_id = %s AND date = %s ORDER BY created_at DESC",
                    (user_id, date))
    else:
        cur.execute("SELECT * FROM diaries WHERE date = %s ORDER BY created_at DESC", (date,))
    
    rows = cur.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        diary = dict(row)
        data = diary.get("emotion_scores") or {}
        diary["emotion_scores"] = data.get("emotion_scores", {})
        diary["emotion_polarity"] = data.get("emotion_polarity", {})
        
        # ISO 형식으로 변환
        if 'created_at' in diary and diary['created_at']:
            if isinstance(diary['created_at'], datetime):
                diary['createdAt'] = diary['created_at'].isoformat()
            else:
                diary['createdAt'] = str(diary['created_at'])
        
        result.append(diary)
    return result

def get_diary_by_id(diary_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM diaries WHERE id = %s", (diary_id,))
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return None
    
    diary = dict(row)
    data = diary.get("emotion_scores") or {}
    diary["emotion_scores"] = data.get("emotion_scores", {})
    diary["emotion_polarity"] = data.get("emotion_polarity", {})
    
    # ISO 형식으로 변환
    if 'created_at' in diary and diary['created_at']:
        if isinstance(diary['created_at'], datetime):
            diary['createdAt'] = diary['created_at'].isoformat()
        else:
            diary['createdAt'] = str(diary['created_at'])
    
    return diary

def delete_diary(diary_id: str, user_id: int = None) -> bool:
    """일기 삭제 (user_id가 있으면 해당 사용자의 일기만 삭제)"""
    conn = get_db()
    cur = conn.cursor()
    if user_id is not None:
        cur.execute("DELETE FROM diaries WHERE id = %s AND user_id = %s", (diary_id, user_id))
    else:
        cur.execute("DELETE FROM diaries WHERE id = %s", (diary_id,))
    deleted_count = cur.rowcount
    conn.commit()
    conn.close()
    return deleted_count > 0

def delete_diary_by_date(date: str, user_id: int = None) -> bool:
    """특정 날짜의 일기 삭제 (user_id가 있으면 해당 사용자의 일기만 삭제)"""
    conn = get_db()
    cur = conn.cursor()
    if user_id is not None:
        cur.execute("DELETE FROM diaries WHERE date = %s AND user_id = %s", (date, user_id))
    else:
        cur.execute("DELETE FROM diaries WHERE date = %s", (date,))
    deleted_count = cur.rowcount
    conn.commit()
    conn.close()
    return deleted_count > 0

# =========================================
# Plaza Functions
# =========================================

def save_plaza_conversation(date: str, conversation: List[Dict], emotion_scores: Dict, user_id: int = None):
    """광장 대화 저장"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO plaza_conversations (date, user_id, conversation, emotion_scores, saved_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (date, user_id) DO UPDATE SET
            conversation = EXCLUDED.conversation,
            emotion_scores = EXCLUDED.emotion_scores,
            saved_at = NOW()
    """, (
        date,
        user_id,
        json.dumps(conversation, ensure_ascii=False),
        json.dumps(emotion_scores, ensure_ascii=False)
    ))
    conn.commit()
    conn.close()
    return True

def get_plaza_conversation_by_date(date: str, user_id: int = None):
    """특정 날짜의 광장 대화 가져오기"""
    if user_id is None:
        user_id = 0
    
    # 날짜 형식 정규화 (공백 제거, 형식 통일)
    date = str(date).strip()
    
    conn = get_db()
    cur = conn.cursor()
    print(f"[DB] plaza_conversations 조회: date='{date}', user_id={user_id}")
    
    # 먼저 user_id로만 조회해서 날짜 형식 확인
    cur.execute("SELECT date, user_id FROM plaza_conversations WHERE user_id = %s LIMIT 5", (user_id,))
    test_rows = cur.fetchall()
    if test_rows:
        print(f"[DB] 같은 user_id의 다른 날짜 예시: {[dict(r)['date'] for r in test_rows]}")
    
    cur.execute("SELECT * FROM plaza_conversations WHERE date = %s AND user_id = %s",
                (date, user_id))
    row = cur.fetchone()
    
    # user_id만으로도 시도 (날짜 형식 불일치 가능성 대비)
    if not row:
        print(f"[DB] date+user_id로 조회 실패, user_id만으로 조회 시도")
        cur.execute("SELECT * FROM plaza_conversations WHERE user_id = %s ORDER BY saved_at DESC LIMIT 10", (user_id,))
        all_rows = cur.fetchall()
        print(f"[DB] user_id={user_id}로 조회된 모든 날짜: {[dict(r)['date'] for r in all_rows] if all_rows else '없음'}")
        
        # 날짜 부분만 비교 시도
        for test_row in all_rows:
            test_date = str(dict(test_row)['date']).strip()
            if test_date == date or test_date.startswith(date) or date.startswith(test_date):
                print(f"[DB] 유사한 날짜 발견: '{test_date}' (원하는 날짜: '{date}')")
                row = test_row
                break
    
    if not row:
        print(f"[DB] plaza_conversations 조회 결과: 없음")
        conn.close()
        return None
    
    row_dict = dict(row)
    print(f"[DB] plaza_conversations 조회 결과: 있음")
    print(f"[DB] - 날짜: {row_dict.get('date')}")
    print(f"[DB] - user_id: {row_dict.get('user_id')}")
    print(f"[DB] - conversation 컬럼 타입: {type(row_dict.get('conversation'))}")
    print(f"[DB] - conversation 컬럼 길이: {len(str(row_dict.get('conversation'))) if row_dict.get('conversation') else 0}")
    
    item = row_dict
    
    # conversation 필드 파싱
    conversation_raw = item.get("conversation")
    if conversation_raw:
        if isinstance(conversation_raw, str):
            try:
                parsed = json.loads(conversation_raw)
                item["conversation"] = parsed
                print(f"[DB] conversation JSON 파싱 성공: {len(parsed) if isinstance(parsed, list) else 'N/A'}개 항목")
            except Exception as e:
                print(f"[DB] conversation JSON 파싱 오류: {e}")
                print(f"[DB] 원본 일부: {str(conversation_raw)[:200]}")
                item["conversation"] = []
        elif isinstance(conversation_raw, list):
            item["conversation"] = conversation_raw
            print(f"[DB] conversation이 이미 리스트: {len(conversation_raw)}개 항목")
        else:
            print(f"[DB] conversation 타입 오류: {type(conversation_raw)}, 값: {str(conversation_raw)[:100]}")
            item["conversation"] = []
    else:
        print(f"[DB] conversation 컬럼이 비어있음")
        item["conversation"] = []
    
    # emotion_scores 필드 파싱
    emotion_scores_raw = item.get("emotion_scores")
    if emotion_scores_raw:
        if isinstance(emotion_scores_raw, str):
            try:
                item["emotionScores"] = json.loads(emotion_scores_raw)
            except Exception as e:
                print(f"[DB] emotion_scores JSON 파싱 오류: {e}")
                item["emotionScores"] = {}
        elif isinstance(emotion_scores_raw, dict):
            item["emotionScores"] = emotion_scores_raw
        else:
            item["emotionScores"] = {}
    else:
        item["emotionScores"] = {}
    
    final_conv_len = len(item["conversation"]) if isinstance(item["conversation"], list) else 0
    print(f"[DB] 최종 파싱 결과 - conversation 개수: {final_conv_len}")
    conn.close()
    return item

def delete_plaza_conversation_by_date(date: str, user_id: int = None) -> bool:
    """특정 날짜의 광장 대화 삭제 (user_id가 있으면 해당 사용자의 대화만 삭제)"""
    conn = get_db()
    cur = conn.cursor()
    if user_id is not None:
        cur.execute("DELETE FROM plaza_conversations WHERE date = %s AND user_id = %s", (date, user_id))
    else:
        cur.execute("DELETE FROM plaza_conversations WHERE date = %s", (date,))
    deleted_count = cur.rowcount
    conn.commit()
    conn.close()
    return deleted_count > 0

# =========================================
# Tree Functions
# =========================================

STAGES = [0, 40, 100, 220, 380, 600]

def get_tree_state(user_id: int = None):
    """행복 나무 상태 가져오기"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tree_state WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    conn.close()
    
    if not row:
        save_tree_state({"growth": 0, "stage": 0}, user_id)
        return {"growth": 0, "stage": 0}
    
    state = dict(row)
    growth = int(state["growth"])
    new_stage = max(i for i, v in enumerate(STAGES) if growth >= v)
    
    if new_stage != state["stage"]:
        save_tree_state({"growth": growth, "stage": new_stage}, user_id)
    
    # ISO 형식으로 변환
    if 'last_updated' in state and state['last_updated']:
        if isinstance(state['last_updated'], datetime):
            state['last_updated'] = state['last_updated'].isoformat()
        else:
            state['last_updated'] = str(state['last_updated'])
    
    return {"growth": growth, "stage": new_stage, "last_updated": state.get('last_updated')}

def save_tree_state(state: Dict[str, Any], user_id: int = None):
    """행복 나무 상태 저장"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    
    # stage가 문자열인 경우 변환
    stage = state.get("stage", 0)
    if isinstance(stage, str):
        stage_map = {
            'seed': 0, 'sprout': 1, 'small': 2,
            'medium': 3, 'large': 4, 'fruit': 5
        }
        stage = stage_map.get(stage.lower(), 0)
    stage = int(stage)
    
    cur.execute("""
        INSERT INTO tree_state (user_id, growth, stage, last_updated)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            growth = EXCLUDED.growth,
            stage = EXCLUDED.stage,
            last_updated = NOW()
    """, (user_id, state["growth"], stage))
    conn.commit()
    conn.close()
    return True

def get_happy_fruit_count(user_id: int = None) -> int:
    """행복 열매 개수 가져오기"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT count FROM happy_fruits WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    conn.close()
    
    if row:
        return row["count"]
    else:
        save_happy_fruit_count(0, user_id)
        return 0

def save_happy_fruit_count(count: int, user_id: int = None) -> bool:
    """행복 열매 개수 저장"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO happy_fruits (user_id, count, last_updated)
        VALUES (%s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            count = EXCLUDED.count,
            last_updated = NOW()
    """, (user_id, count))
    conn.commit()
    conn.close()
    return True

# =========================================
# Well Functions
# =========================================

def get_well_state(user_id: int = None):
    """스트레스 우물 상태 가져오기"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM well_state WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    conn.close()
    
    if not row:
        default_state = {
            "waterLevel": 0,
            "isOverflowing": False,
            "lastOverflowDate": None
        }
        save_well_state(default_state, user_id)
        return default_state
    
    state = dict(row)
    result = {
        "waterLevel": state["water_level"],
        "isOverflowing": state["is_overflowing"],
        "lastOverflowDate": state["last_overflow_date"]
    }
    
    # ISO 형식으로 변환
    if 'last_updated' in state and state['last_updated']:
        if isinstance(state['last_updated'], datetime):
            result['last_updated'] = state['last_updated'].isoformat()
        else:
            result['last_updated'] = str(state['last_updated'])
    
    return result

def save_well_state(state: Dict[str, Any], user_id: int = None):
    """스트레스 우물 상태 저장"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO well_state (user_id, water_level, is_overflowing, last_overflow_date, last_updated)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            water_level = EXCLUDED.water_level,
            is_overflowing = EXCLUDED.is_overflowing,
            last_overflow_date = EXCLUDED.last_overflow_date,
            last_updated = NOW()
    """, (
        user_id,
        state["waterLevel"],
        state["isOverflowing"],
        state["lastOverflowDate"]
    ))
    conn.commit()
    conn.close()
    return True

# =========================================
# Letters Functions
# =========================================

def save_letter(letter: Dict[str, Any], user_id: int = None):
    """편지 저장"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    letter_id = letter.get("id") or str(int(datetime.now().timestamp() * 1000))
    cur.execute("""
        INSERT INTO letters (id, user_id, title, content, from_character, type, date, is_read, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (
        letter_id,
        user_id,
        letter["title"],
        letter["content"],
        letter["from"],
        letter["type"],
        letter["date"],
        letter.get("isRead", False)
    ))
    conn.commit()
    conn.close()
    return True

def get_all_letters(user_id: int = None):
    """모든 편지 가져오기 (user_id가 있으면 필터링)"""
    conn = get_db()
    cur = conn.cursor()
    
    if user_id is not None:
        cur.execute("SELECT * FROM letters WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    else:
        cur.execute("SELECT * FROM letters ORDER BY created_at DESC")
    
    rows = cur.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        row = dict(row)
        row["from"] = row.pop("from_character")
        row["isRead"] = row["is_read"]
        row["createdAt"] = row["created_at"]
        
        # ISO 형식으로 변환
        if 'createdAt' in row and row['createdAt']:
            if isinstance(row['createdAt'], datetime):
                row['createdAt'] = row['createdAt'].isoformat()
            else:
                row['createdAt'] = str(row['createdAt'])
        
        result.append(row)
    return result

def mark_letter_as_read(letter_id: str, user_id: int = None):
    """편지 읽음 표시"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE letters SET is_read = TRUE WHERE id = %s AND user_id = %s",
                (letter_id, user_id))
    conn.commit()
    conn.close()
    return True

def delete_letter(letter_id: str, user_id: int = None):
    """편지 삭제"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM letters WHERE id = %s AND user_id = %s", (letter_id, user_id))
    deleted_count = cur.rowcount
    conn.commit()
    conn.close()
    return deleted_count > 0

def delete_letters_by_date_and_type(date: str, letter_type: str, user_id: int = None):
    """특정 날짜와 타입의 편지 삭제 (일기 삭제 시 관련 편지 삭제용)"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM letters WHERE date = %s AND type = %s AND user_id = %s",
        (date, letter_type, user_id)
    )
    deleted_count = cur.rowcount
    conn.commit()
    conn.close()
    return deleted_count

def get_unread_letter_count(user_id: int = None):
    """읽지 않은 편지 개수"""
    if user_id is None:
        user_id = 0
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as count FROM letters WHERE user_id = %s AND is_read = FALSE",
                (user_id,))
    row = cur.fetchone()
    conn.close()
    return row["count"] if row else 0
