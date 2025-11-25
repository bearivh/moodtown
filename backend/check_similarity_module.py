"""
유사 일기 검색 모듈 상태 확인 스크립트
서버 시작 전에 모듈이 정상적으로 로드되는지 확인
"""
import sys
import os

# Windows 인코딩 문제 해결
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 50)
print("유사 일기 검색 모듈 상태 확인")
print("=" * 50)

# 1. gensim 설치 확인
print("\n[1/3] gensim 라이브러리 확인...")
try:
    import gensim
    print(f"✅ gensim 설치됨 (버전: {gensim.__version__})")
except ImportError:
    print("❌ gensim이 설치되지 않았습니다.")
    print("   설치 명령: pip install gensim")
    sys.exit(1)

# 2. 모듈 import 확인
print("\n[2/3] 모듈 import 확인...")
sys.path.append(os.path.dirname(__file__) + "/services")
try:
    from diary_similarity import find_similar_diaries, load_model
    print("✅ diary_similarity 모듈 import 성공")
except Exception as e:
    print(f"❌ 모듈 import 실패: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 3. 모델 로드 확인
print("\n[3/3] 모델 로드 확인...")
try:
    result = load_model()
    if result:
        print("✅ 모델 로드 성공")
    else:
        print("⚠️ 모델 로드 실패 - 모델 파일이 없거나 손상되었을 수 있습니다.")
        print("   학습 명령: python backend/services/train_diary_similarity.py")
except Exception as e:
    print(f"❌ 모델 로드 중 오류: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 50)
print("확인 완료!")
print("=" * 50)

