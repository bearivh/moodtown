# SECRET_KEY 가이드

## SECRET_KEY란?

`SECRET_KEY`는 Flask 애플리케이션에서 **세션 쿠키를 암호화**하기 위해 사용하는 비밀키입니다.

### 사용 용도:
1. **세션 쿠키 암호화**: 사용자 로그인 상태를 안전하게 저장
2. **보안**: 세션 쿠키가 변조되는 것을 방지
3. **인증**: 서버가 발급한 쿠키임을 확인

### 왜 필요한가요?
- 로그인 세션을 안전하게 관리
- 쿠키 변조 공격 방지
- 사용자 인증 정보 보호

---

## SECRET_KEY 생성 방법

### 방법 1: Python으로 생성 (추천)

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

또는:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 방법 2: 온라인 생성기 사용
- [RandomKeygen](https://randomkeygen.com/)
- "CodeIgniter Encryption Keys" 섹션의 256-bit 키 사용

### 방법 3: 간단한 랜덤 문자열

임의의 긴 문자열을 사용해도 됩니다:
```
moodtown-2024-secret-key-abc123xyz789-random-string
```

⚠️ **주의**: 프로덕션에서는 반드시 랜덤하고 추측하기 어려운 키를 사용하세요!

---

## Render에서 설정하는 방법

1. Render Dashboard → Web Service 선택
2. "Environment" 탭 클릭
3. "Add Environment Variable" 클릭
4. 다음 입력:
   - **Key**: `SECRET_KEY`
   - **Value**: 생성한 랜덤 문자열 (예: `abc123xyz789...`)
5. "Save Changes" 클릭

---

## 예시

### 안전한 SECRET_KEY 예시:
```
A8K9mN2pQ5rS7tU3vW6xY1zA4bC5dE8fG9hI0jK1lM2nO3pQ4rS5t
```

### 간단한 예시 (학교 프로젝트용):
```
moodtown-secret-key-2024-school-project
```

---

## 중요 사항

1. ✅ **프로덕션에서는 반드시 랜덤 키 사용**
2. ✅ **절대 GitHub에 공개하지 않기** (환경 변수로만 관리)
3. ✅ **키를 변경하면 모든 사용자 세션이 초기화됨**

---

## 현재 코드에서의 사용

```python
# backend/app.py
app.secret_key = os.environ.get('SECRET_KEY', 'moodtown-secret-key-for-session')
```

- 환경 변수 `SECRET_KEY`가 있으면 사용
- 없으면 기본값 사용 (개발 환경용)
- 프로덕션에서는 반드시 환경 변수로 설정해야 함

