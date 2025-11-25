"""
SQLite 데이터베이스 모델 및 초기화
"""
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), 'moodtown.db')

def get_db_connection():
    """데이터베이스 연결 반환"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 딕셔너리처럼 접근 가능하게
    return conn

def init_db():
    """데이터베이스 초기화 및 테이블 생성"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 사용자 테이블
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
        cursor.execute("ALTER TABLE users ADD COLUMN username TEXT")
        # 기존 email 값을 username으로 복사
        cursor.execute("UPDATE users SET username = email WHERE username IS NULL AND email IS NOT NULL")
        # email 컬럼 제거는 SQLite에서 직접 지원하지 않으므로 유지하되, username을 우선 사용
        # 기존 데이터가 있으면 username이 설정되고, 없으면 NULL이 됨
    except sqlite3.OperationalError:
        pass  # 이미 username 컬럼이 있거나 마이그레이션이 완료된 경우
    
    # 일기 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diaries (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            emotion_scores TEXT,  -- JSON 문자열
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 기존 테이블에 user_id 컬럼 추가 (마이그레이션)
    try:
        cursor.execute("ALTER TABLE diaries ADD COLUMN user_id INTEGER")
        # 기존 데이터는 NULL이 될 수 있으므로 임시로 0으로 설정
        cursor.execute("UPDATE diaries SET user_id = 0 WHERE user_id IS NULL")
    except sqlite3.OperationalError:
        pass  # 컬럼이 이미 존재하는 경우
    
    # 광장 대화 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plaza_conversations (
            date TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            conversation TEXT NOT NULL,  -- JSON 문자열
            emotion_scores TEXT,  -- JSON 문자열
            saved_at TEXT NOT NULL,
            PRIMARY KEY (date, user_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 마이그레이션: 기존 plaza_conversations에 user_id 추가 (간단하게 처리)
    try:
        cursor.execute("ALTER TABLE plaza_conversations ADD COLUMN user_id INTEGER")
        cursor.execute("UPDATE plaza_conversations SET user_id = 0 WHERE user_id IS NULL")
    except sqlite3.OperationalError:
        pass  # 컬럼이 이미 존재하거나 테이블이 없는 경우
    
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
            is_overflowing INTEGER NOT NULL DEFAULT 0,  -- 0 or 1 (boolean)
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
            is_read INTEGER NOT NULL DEFAULT 0,  -- 0 or 1 (boolean)
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 마이그레이션: letters에 user_id 추가
    try:
        cursor.execute("ALTER TABLE letters ADD COLUMN user_id INTEGER")
        cursor.execute("UPDATE letters SET user_id = 0 WHERE user_id IS NULL")
    except sqlite3.OperationalError:
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
    print(f"✅ 데이터베이스 초기화 완료: {DB_PATH}")

# ===============================
# 사용자 관련 함수
# ===============================

def create_user(username: str, password: str, name: str = None) -> Optional[int]:
    """새 사용자 생성"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 비밀번호 해싱 (간단한 SHA-256 사용)
        import hashlib
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        created_at = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO users (username, password, name, created_at)
            VALUES (?, ?, ?, ?)
        ''', (username, hashed_password, name, created_at))
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        # 아이디 중복
        return None
    except Exception as e:
        print(f"사용자 생성 실패: {e}")
        return None

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """아이디로 사용자 찾기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # username 컬럼이 있으면 우선 사용, 없으면 email 컬럼 확인 (마이그레이션 호환성)
        try:
            cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        except sqlite3.OperationalError:
            # username 컬럼이 없으면 email로 시도 (구버전 호환)
            cursor.execute('SELECT * FROM users WHERE email = ?', (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            user = dict(row)
            user['id'] = user['id']  # 정수로 유지
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
        # 비밀번호는 반환하지 않음
        user.pop('password', None)
        return user
    return None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """ID로 사용자 찾기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # 모든 컬럼 조회 (username, email 모두 확인 가능하도록)
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            user = dict(row)
            # username이 없으면 email을 username으로 사용 (마이그레이션 호환성)
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
            # 호환성을 위해 기본값 0 사용 (로그인하지 않은 경우)
            user_id = 0
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        diary_id = diary.get('id') or str(int(datetime.now().timestamp() * 1000))
        date = diary.get('date') or datetime.now().strftime('%Y-%m-%d')
        title = diary.get('title', '')
        content = diary.get('content', '')
        # emotion_scores와 emotion_polarity를 함께 저장 (호환성을 위해)
        emotion_data = {
            'emotion_scores': diary.get('emotion_scores', {}),
            'emotion_polarity': diary.get('emotion_polarity', {})
        }
        emotion_scores = json.dumps(emotion_data, ensure_ascii=False)
        created_at = diary.get('createdAt') or datetime.now().isoformat()
        updated_at = datetime.now().isoformat()
        
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
            # 호환성: emotion_scores가 직접 객체인 경우와 emotion_data 안에 있는 경우 모두 처리
            if isinstance(emotion_data, dict) and 'emotion_scores' in emotion_data:
                diary['emotion_scores'] = emotion_data.get('emotion_scores', {})
                diary['emotion_polarity'] = emotion_data.get('emotion_polarity', {})
            else:
                # 기존 형식 (emotion_scores만 있는 경우)
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
            # 호환성: emotion_scores가 직접 객체인 경우와 emotion_data 안에 있는 경우 모두 처리
            if isinstance(emotion_data, dict) and 'emotion_scores' in emotion_data:
                diary['emotion_scores'] = emotion_data.get('emotion_scores', {})
                diary['emotion_polarity'] = emotion_data.get('emotion_polarity', {})
            else:
                # 기존 형식 (emotion_scores만 있는 경우)
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
        cursor.execute('SELECT * FROM diaries WHERE id = ?', (diary_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            diary = dict(row)
            emotion_data = json.loads(diary['emotion_scores'] or '{}')
            # 호환성: emotion_scores가 직접 객체인 경우와 emotion_data 안에 있는 경우 모두 처리
            if isinstance(emotion_data, dict) and 'emotion_scores' in emotion_data:
                diary['emotion_scores'] = emotion_data.get('emotion_scores', {})
                diary['emotion_polarity'] = emotion_data.get('emotion_polarity', {})
            else:
                # 기존 형식 (emotion_scores만 있는 경우)
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

def save_plaza_conversation(date: str, conversation: List[Dict], emotion_scores: Dict) -> bool:
    """광장 대화 저장"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        conversation_json = json.dumps(conversation, ensure_ascii=False)
        emotion_scores_json = json.dumps(emotion_scores, ensure_ascii=False)
        saved_at = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT OR REPLACE INTO plaza_conversations 
            (date, conversation, emotion_scores, saved_at)
            VALUES (?, ?, ?, ?)
        ''', (date, conversation_json, emotion_scores_json, saved_at))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"대화 저장 실패: {e}")
        return False

def get_plaza_conversation_by_date(date: str) -> Optional[Dict[str, Any]]:
    """특정 날짜의 광장 대화 가져오기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM plaza_conversations WHERE date = ?', (date,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            result = dict(row)
            # JSON 파싱 시 안전하게 처리
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
        cursor.execute('SELECT * FROM tree_state WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        # 단계 임계값 정의 (씨앗, 새싹, 묘목, 중간 나무, 큰 나무, 열매)
        stage_thresholds = [0, 40, 100, 220, 380, 600]
        
        if row:
            state = dict(row)
            # growth를 숫자로 보장
            growth = int(state.get('growth', 0))
            
            # 성장도에 맞는 단계 계산
            calculated_stage = 0
            for i in range(len(stage_thresholds) - 1, -1, -1):
                if growth >= stage_thresholds[i]:
                    calculated_stage = i
                    break
            
            # 저장된 단계와 계산된 단계가 다르면 업데이트
            stored_stage = state.get('stage', 0)
            if isinstance(stored_stage, str):
                stage_map = {
                    'seed': 0, 'sprout': 1, 'small': 2, 'seedling': 2,
                    'medium': 3, 'large': 4, 'fruit': 5
                }
                stored_stage = stage_map.get(stored_stage.lower(), 0)
            stored_stage = int(stored_stage)
            
            if stored_stage != calculated_stage:
                # 단계 불일치 수정 및 저장
                state['stage'] = calculated_stage
                state['growth'] = growth
                save_tree_state(state, user_id)
                print(f"나무 단계 자동 수정: {stored_stage} -> {calculated_stage} (성장도: {growth})")
            
            state['stage'] = calculated_stage
            state['growth'] = growth
            return state
        else:
            # 초기 상태 생성
            now = datetime.now().isoformat()
            default_state = {
                'growth': 0,
                'stage': 0,  # 숫자로 저장
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
        
        # stage를 숫자로 변환
        stage = state.get('stage', 0)
        if isinstance(stage, str):
            stage_map = {
                'seed': 0, 'sprout': 1, 'small': 2, 
                'medium': 3, 'large': 4, 'fruit': 5
            }
            stage = stage_map.get(stage.lower(), 0)
        stage = int(stage)
        
        # growth를 숫자로 보장
        growth = int(state.get('growth', 0))
        
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
        cursor.execute('SELECT count FROM happy_fruits WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)['count']
        else:
            # 초기화
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
        cursor.execute('SELECT * FROM well_state WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            state = dict(row)
            state['isOverflowing'] = bool(state['is_overflowing'])
            return state
        else:
            # 초기 상태 생성
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

def save_letter(letter: Dict[str, Any]) -> bool:
    """편지 저장"""
    try:
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
        
        cursor.execute('''
            INSERT INTO letters 
            (id, title, content, from_character, type, date, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (letter_id, title, content, from_character, letter_type, date, is_read, created_at))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"편지 저장 실패: {e}")
        return False

def get_all_letters() -> List[Dict[str, Any]]:
    """모든 편지 가져오기"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
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

def mark_letter_as_read(letter_id: str) -> bool:
    """편지 읽음 표시"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('UPDATE letters SET is_read = 1 WHERE id = ?', (letter_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"편지 읽음 표시 실패: {e}")
        return False

def delete_letter(letter_id: str) -> bool:
    """편지 삭제"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM letters WHERE id = ?', (letter_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"편지 삭제 실패: {e}")
        return False

def get_unread_letter_count() -> int:
    """읽지 않은 편지 개수"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM letters WHERE is_read = 0')
        row = cursor.fetchone()
        conn.close()
        return dict(row)['count'] if row else 0
    except Exception as e:
        print(f"읽지 않은 편지 개수 불러오기 실패: {e}")
        return 0

