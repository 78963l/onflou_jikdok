/**
 * PDF에서 추출한 텍스트를 영어 문장 단위로 분리
 * 영어 문장만 필터링하여 반환
 */
import nlp from 'compromise';

// 영어 문장 판별 기준: 한글 없음 + 알파벳 비율 40% 이상
function isEnglishSentence(text) {
  // 한글이 1자라도 있으면 제외
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)) return false;

  const cleaned = text.replace(/\s+/g, '');
  if (cleaned.length < 5) return false;
  const englishChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
  return englishChars / cleaned.length >= 0.4;
}

// 단어 3개 이상, 10자 이상, 대문자 시작, 문장 부호로 끝나야 함
function isValidSentence(text) {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 3 || trimmed.length < 10) return false;
  if (!/^[A-Z"']/.test(trimmed)) return false; // 반드시 대문자(또는 따옴표)로 시작
  return /[.!?]["']?\s*$/.test(trimmed);
}

/**
 * compromise로 동사가 있는 실제 영어 문장인지 검사
 * 동사(verbs)가 하나 이상 있어야 진짜 문장으로 판단
 */
function hasVerb(text) {
  const doc = nlp(text);
  return doc.verbs().length > 0;
}

/**
 * 교재 특유의 문제 지시문·순서 나열·헤더 등 불필요한 줄 감지
 * true이면 해당 줄 제외
 */
function isJunkLine(text) {
  // (A)–(B)–(C) 형태의 순서 나열
  if (/\([A-Za-z]\)\s*[-–—]\s*\([A-Za-z]\)/.test(text)) return true;

  // A – B – C 형태 (단독 알파벳 dash 나열)
  if (/^[A-Z]\s*[-–—]\s*[A-Z](\s*[-–—]\s*[A-Z])*\s*$/.test(text.trim())) return true;

  // 여러 "A – B – C" 조합 반복
  if (/([A-Z]\s*[-–—]\s*[A-Z]\s*[-–—]\s*[A-Z]\s*){2,}/.test(text)) return true;

  // 한글 안내 문구
  if (/직독직해|끊어 읽|해석하시오|다음 문장|보기|정답/.test(text)) return true;

  // 섹션 헤더: 연속된 대문자 단어 3개 이상 (GRAMMAR PLUS EXERCISE 등)
  const upperWords = (text.match(/\b[A-Z]{2,}\b/g) || []);
  if (upperWords.length >= 3) return true;

  // Step 1 Step 2 / Exercise Step 같은 연습문제 헤더
  if (/\bStep\s+\d|\bExercise\b|\bPLUS\b|\bUnit\s+\d/i.test(text) && upperWords.length >= 2) return true;

  // REVIEW TEST 38 / PART 1 / CHAPTER 2 같은 섹션 타이틀
  if (/\b(REVIEW|TEST|PART|CHAPTER|SECTION|LESSON|UNIT)\s+\d/i.test(text)) return true;

  // 같은 단어가 전체의 50% 이상 반복 (The The The The...)
  const words = text.trim().split(/\s+/);
  if (words.length >= 4) {
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    const maxFreq = Math.max(...Object.values(freq));
    if (maxFreq / words.length >= 0.5) return true;
  }

  // 단일 알파벳·숫자 토큰이 연속 5개 이상 (a b c d 2 a c d ... 보기 목록 패턴)
  let consecutive = 0;
  for (const t of words) {
    if (/^[a-z0-9]$/i.test(t)) {
      if (++consecutive >= 5) return true;
    } else {
      consecutive = 0;
    }
  }

  return false;
}

/**
 * 문장 앞의 레이블 제거
 * 예) "1 She went..."   → "She went..."
 *     "a She went..."   → "She went..."
 *     "(A) Therefore..."→ "Therefore..."
 *     "1. She went..."  → "She went..."
 */
function stripLeadingLabel(text) {
  return text
    // "(A) " / "(1) " 대소문자 괄호 형태 — 먼저 처리
    .replace(/^\([a-z0-9]+\)\s*/i, '')
    // "1 " / "12 " 숫자 + 공백
    .replace(/^\d+\s+/, '')
    // "1. " / "12. " 숫자 + 점
    .replace(/^\d+\.\s*/, '')
    // "a " / "b " 단일 소문자 알파벳 + 공백 (대문자 뒤에 오는 경우 제외)
    .replace(/^[a-z]\s+(?=[A-Z])/, '')
    .trim();
}

/**
 * 알려진 junk 토큰(숫자, 단일 소문자, 헤더 키워드)을 앞에서 반복 제거하여
 * 실제 문장 시작점을 탐색
 * 예) "EXERCISE Step 1 Step 2 18 1 He is in the garden."
 *   → "He is in the garden."
 */
function stripJunkPrefix(text) {
  let result = text.trim();
  const junkToken =
    /^(?:\d+\.?\s+|[a-z]\s+|(?:EXERCISE|Step|Unit|PART|CHAPTER|SECTION|LESSON|TEST|REVIEW)\s*\d*\s*)/i;

  let i = 0;
  while (i++ < 30 && result.length > 0) {
    const m = result.match(junkToken);
    if (!m) break;
    result = result.slice(m[0].length).trim();
  }

  return result;
}

/**
 * 문자열을 문장 단위로 분리
 * 약어(Mr. Dr. etc.) 뒤의 마침표는 문장 끝으로 처리하지 않음
 */
function splitIntoSentences(text) {
  const abbrevPattern = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|U\.S|U\.K)\./gi;
  const placeholder = '<<<DOT>>>';

  const protected_text = text.replace(abbrevPattern, (match) =>
    match.replace('.', placeholder)
  );

  const raw = protected_text.split(/(?<=[.!?])\s*(?=[A-Z"'])/);

  return raw.map((s) => s.replace(new RegExp(placeholder, 'g'), '.'));
}

/**
 * 텍스트 내 원문자(① ② ...) 및 밑줄 번호 인라인 제거
 * 줄 전체를 버리지 않고 해당 기호만 제거
 */
function stripInlineMarkers(text) {
  return text
    // 원문자 ①~⑫
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]/g, '')
    // 밑줄 번호 패턴: _(숫자)_ 또는 __단어__ 형태
    .replace(/_+\d+_+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 한글이 포함된 줄인지 판별 (질문 헤더, 지시문 등)
 */
function hasKorean(text) {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

/**
 * 줄바꿈으로 끊긴 문장을 이어 붙임
 * - 빈 줄: 단락 구분 → flush
 * - 한글 포함 줄: 질문/지시문으로 판단 → flush 후 버림
 * - junk 줄: flush 후 버림
 * - 문장 부호(.!?)로 끝나는 줄: 완결 → flush
 * - 그 외: 다음 줄과 이어 붙임
 */
function joinContinuationLines(text) {
  const lines = text.split('\n');
  const joined = [];
  let buffer = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // 빈 줄 = 단락 구분
    if (!trimmed) {
      if (buffer) { joined.push(buffer); buffer = ''; }
      continue;
    }

    // 한글 포함 줄 = 질문/지시문 → 버퍼 flush 후 해당 줄 버림
    if (hasKorean(trimmed)) {
      if (buffer) { joined.push(buffer); buffer = ''; }
      continue;
    }

    // 원문자 등 인라인 마커 제거
    const cleaned = stripInlineMarkers(trimmed);

    // 전처리 후 junk 줄 제외
    if (!cleaned || isJunkLine(cleaned)) {
      if (buffer) { joined.push(buffer); buffer = ''; }
      continue;
    }

    buffer = buffer ? buffer + ' ' + cleaned : cleaned;

    // 문장 종결 부호로 끝나면 flush
    if (/[.!?]["']?\s*$/.test(cleaned)) {
      joined.push(buffer);
      buffer = '';
    }
  }

  if (buffer) joined.push(buffer);
  return joined;
}

/**
 * 텍스트에서 영어 문장을 추출
 * @param {string} text 원본 텍스트
 * @returns {string[]} 영어 문장 배열
 */
export function extractEnglishSentences(text) {
  if (!text || typeof text !== 'string') return [];

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // 줄바꿈으로 끊긴 문장을 먼저 이어 붙임
  const paragraphs = joinContinuationLines(normalized);

  const sentences = [];

  for (const para of paragraphs) {
    const parts = splitIntoSentences(para);

    for (const part of parts) {
      const labeled = stripLeadingLabel(part.trim());
      // 앞쪽 junk 토큰(헤더·숫자·단일 알파벳) 추가 제거
      const prefixStripped = stripJunkPrefix(labeled);
      // 청킹 구분자 "/" 제거 + 공백 정리
      const clean = prefixStripped.replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean && isEnglishSentence(clean) && isValidSentence(clean) && !isJunkLine(clean) && hasVerb(clean)) {
        sentences.push(clean);
      }
    }
  }

  return [...new Set(sentences)];
}

/**
 * 페이지별 텍스트에서 문장 추출 (페이지 번호 포함)
 * @param {string[]} pageTexts 페이지별 텍스트 배열
 * @returns {{ pageNo: number, sentence: string, order: number }[]}
 */
export function extractSentencesWithPageInfo(pageTexts) {
  const results = [];
  let globalOrder = 0;

  for (let i = 0; i < pageTexts.length; i++) {
    const pageNo = i + 1;
    const sentences = extractEnglishSentences(pageTexts[i]);

    for (let j = 0; j < sentences.length; j++) {
      results.push({ pageNo, sentence: sentences[j], order: globalOrder++ });
    }
  }

  return results;
}

/**
 * LanguageTool API로 문법 검사 후 오류 없는 문장만 반환
 * 전체 문장을 한 번에 전송해 API 호출 1회로 처리
 * @param {{ pageNo: number, sentence: string, order: number }[]} sentenceObjs
 * @returns {Promise<{ pageNo: number, sentence: string, order: number }[]>}
 */
export async function filterByGrammar(sentenceObjs) {
  if (sentenceObjs.length === 0) return [];

  // 각 문장의 시작 offset 계산 (줄바꿈 2개로 구분)
  const SEP = '\n\n';
  const texts = sentenceObjs.map((s) => s.sentence);
  const offsets = [];
  let pos = 0;
  for (const t of texts) {
    offsets.push(pos);
    pos += t.length + SEP.length;
  }
  const joined = texts.join(SEP);

  try {
    const body = new URLSearchParams({ language: 'en-US', text: joined });
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      console.warn('[문법 검사] API 오류, 필터 건너뜀');
      return sentenceObjs;
    }

    const data = await res.json();
    const matches = data.matches || [];

    // 오류가 걸리는 문장 인덱스 수집 (WHITESPACE 등 사소한 규칙 제외)
    const SKIP_CATEGORIES = new Set(['TYPOGRAPHY', 'WHITESPACE', 'PUNCTUATION']);
    const errorSet = new Set();

    for (const match of matches) {
      const cat = match.rule?.category?.id || '';
      if (SKIP_CATEGORIES.has(cat)) continue;

      const errStart = match.offset;
      const errEnd = match.offset + match.length;

      for (let i = 0; i < offsets.length; i++) {
        const sentStart = offsets[i];
        const sentEnd = sentStart + texts[i].length;
        if (errStart < sentEnd && errEnd > sentStart) {
          errorSet.add(i);
        }
      }
    }

    const passed = sentenceObjs.filter((_, i) => !errorSet.has(i));
    console.log(`[문법 검사] ${sentenceObjs.length}개 중 ${passed.length}개 통과 (${errorSet.size}개 제거)`);
    return passed;
  } catch (err) {
    console.warn('[문법 검사] 실패, 필터 건너뜀:', err.message);
    return sentenceObjs; // 오류 시 필터링 없이 그대로 반환
  }
}
