# Jikdok Admin

교재 PDF에서 영어 문장을 자동 추출하고 AI 청킹(직독직해 단위 분리)을 관리하는 어드민 시스템입니다.

---

## 시작하기

```bash
# 패키지 설치
npm install

# DB 스키마 동기화
npx prisma db push

# 개발 서버 실행
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

---

## 환경 변수

`.env` 파일을 생성하고 아래 값을 설정하세요. `.env.example` 참고.

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | MySQL 연결 문자열 |
| `GEMINI_API_KEY` | Google Gemini API 키 (청킹용) |

---

## 주요 기능

- **교재 관리**: PDF 업로드, 교재 목록 조회, 선택 삭제
- **문장 관리**: 추출 문장 목록, 필터/검색, 상태 변경, 선택 삭제, 청킹 실행
- **문장 도구**: 청킹 테스트, 문법 검사, 문장 개별 등록

---

## PDF 업로드 전체 플로우

```
[사용자]
  │
  │  PDF 파일 + 교재명/학년/단원명 전송
  ▼
[POST /api/admin/textbooks/upload]
  │
  ├─ 1. 입력값 검증 (파일·교재명·학년·단원명 필수, PDF 형식 확인)
  │
  ├─ 2. 파일 저장
  │      Buffer 변환 → public/uploads/{timestamp}_{파일명} 저장
  │
  ├─ 3. PDF 텍스트 추출 [lib/pdfParser.js]
  │      pdf-parse 라이브러리로 페이지별 텍스트 배열 생성
  │      page 1: "She went to school...", page 2: "..."
  │
  ├─ 4. 영어 문장 추출 [lib/sentenceExtractor.js]
  │      └─ 자세한 파이프라인은 아래 "문장 추출 파이프라인" 참고
  │         결과: [{ pageNo, sentence, order }, ...]
  │
  ├─ 5. 문법 검사 필터 [LanguageTool API]
  │      전체 문장을 1회 API 호출로 검사
  │      TYPOGRAPHY / WHITESPACE / PUNCTUATION 카테고리 오류는 무시
  │      결과: 문법 오류 없는 문장만 통과
  │
  ├─ 6. DB 저장 [Prisma 트랜잭션]
  │      ┌─ Textbook 레코드 생성 (교재명, 학년, 단원명, 파일 경로)
  │      └─ TextbookSentence 레코드 일괄 생성 (문장, 페이지, 순서, status: pending)
  │
  └─ 7. 응답 반환
         { textbook_id, sentence_count, message }
```

### 청킹 플로우 (문장 관리 페이지에서 수동 실행)

```
[사용자] 문장 선택 → 청킹 버튼 클릭
  │
  ▼
[POST /api/admin/sentences/{id}/chunking]
  │
  ├─ 1. Gemini API 호출 [lib/gemini.js]
  │      모델: gemini-2.5-flash (thinkingBudget: 0, 빠른 응답)
  │      503 오류 시 fallback 모델로 재시도
  │
  ├─ 2. 프롬프트 빌드
  │      난이도 (하/중/상)에 따른 청킹 가이드 + 예시 포함
  │
  ├─ 3. 응답 파싱 (3줄 형식)
  │      1번째 줄: 청킹된 영어 원문  (e.g. "She went / to school / early.")
  │      2번째 줄: 직독직해 한국어   (e.g. "그녀는 갔다 / 학교에 / 일찍.")
  │      3번째 줄: 문법 역할 레이블  (e.g. "[주어] / [부사구] / [부사]")
  │
  └─ 4. DB 저장
         ChunkingResult 생성 + TextbookSentence status → chunked
```

---

## 문장 추출 파이프라인

`lib/sentenceExtractor.js` 에서 구현된 PDF 텍스트 → 영어 문장 변환 파이프라인입니다.

### STEP 1 — 전처리 (줄 단위)

| 처리 | 예시 |
|---|---|
| 빈 줄 → 단락 구분 flush | |
| 한글 포함 줄 → 버리고 flush | `1 다음 글의 밑줄 친 부분...`, `직독직해 PLUS` |
| 원문자 인라인 제거 | `① crowded` → `crowded` |
| `_1_`, `__단어__` 밑줄 번호 제거 | |
| junk 줄 → 버리고 flush | |
| 마침표 없이 끝나는 줄 → 다음 줄과 이어붙임 | `is a busy` + `metropolis.` → 합침 |
| 마침표로 끝나는 줄 → flush | |

### STEP 1-5 — junk 앞부분 제거 (`stripJunkPrefix`)

STEP 1에서 이어붙인 단락 안에 헤더·숫자·단일 알파벳 등 junk가 섞여 있을 때,
실제 문장 시작점이 나올 때까지 앞에서 반복 제거합니다.

| 입력 | 출력 |
|---|---|
| `EXERCISE Step 1 Step 2 18 1 He is in the garden.` | `He is in the garden.` |
| `1 a She went to school.` | `She went to school.` |

최대 30회 반복하며, 아래 토큰을 순서대로 제거합니다.
- 숫자 (점 포함): `18 `, `1. `
- 단일 소문자: `a `, `b `
- 헤더 키워드 + 번호: `EXERCISE`, `Step 1`, `Unit 2`, `PART 1`, `CHAPTER`, `SECTION`, `LESSON`, `TEST`, `REVIEW`

### STEP 2 — 문장 분리 (`splitIntoSentences`)

STEP 1에서 이어붙인 단락을 개별 문장으로 분리합니다.

- `.!?` 뒤에 대문자가 오면 문장 경계로 판단
- `Mr.` `Dr.` `e.g.` `U.S.` 등 약어의 마침표는 문장 끝으로 처리하지 않음

### STEP 3 — 레이블 제거 (`stripLeadingLabel`)

| 패턴 | 예시 |
|---|---|
| 괄호 레이블 | `(A) Therefore...` → `Therefore...` |
| 숫자 + 공백 | `1 She went...` → `She went...` |
| 숫자 + 점 | `1. She went...` → `She went...` |
| 소문자 알파벳 + 공백 | `a She went...` → `She went...` |
| 슬래시 구분자 | `went / to school` → `went to school` |

### STEP 4 — 최종 필터 (4중 검사)

| 순서 | 함수 | 기준 |
|---|---|---|
| ① | `isEnglishSentence` | 한글 없음 + 알파벳 비율 40% 이상 |
| ② | `isValidSentence` | 대문자로 시작 + 단어 3개 이상 + 10자 이상 + `.!?`로 끝남 |
| ③ | `isJunkLine` | junk 패턴 방어 (아래 참고) |
| ④ | `hasVerb` (Compromise) | 동사 1개 이상 존재 |

### junk 줄 판별 기준 (`isJunkLine`)

| 패턴 | 예시 |
|---|---|
| 괄호 순서 나열 | `(A) – (B) – (C)` |
| 단독 알파벳 dash 나열 | `A – B – C` |
| 여러 알파벳 조합 반복 | `A – B – C  A – C – B` |
| 한글 키워드 | `직독직해`, `끊어 읽`, `해석하시오`, `다음 문장`, `보기`, `정답` |
| 대문자 단어 3개 이상 | `GRAMMAR PLUS EXERCISE` |
| 헤더 키워드 + 대문자 2개 이상 | `Step 1`, `Exercise`, `PLUS`, `Unit 1` |
| 섹션 타이틀 + 번호 | `REVIEW TEST 38`, `PART 1`, `CHAPTER 2`, `SECTION 3`, `LESSON 4` |
| 같은 단어 50% 이상 반복 | `The The The The The` |
| 단일 알파벳·숫자 토큰 연속 5개 이상 | `a b c d 2 a c d` (보기 목록) |

### 기타

- 중복 문장 자동 제거 (`Set`)
- 영어 자연어 처리 검증 (Compromise 라이브러리)
- 영어 문법 검사 필터 (LanguageTool API) — `TYPOGRAPHY`, `WHITESPACE`, `PUNCTUATION` 카테고리 오류는 무시

---

## 기술 스택

- **Framework**: Next.js (App Router)
- **Database**: MySQL + Prisma ORM
- **AI**: Google Gemini API (청킹)
- **NLP**: Compromise (동사 검출)
- **문법 검사**: LanguageTool API
- **Styling**: Tailwind CSS
