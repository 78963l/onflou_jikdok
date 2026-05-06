import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 청킹 전용 모델 (thinking 없이 빠른 응답)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    thinkingConfig: { thinkingBudget: 0 },
  },
});

// fallback 모델 (503 대비)
const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * 난이도별 청킹 가이드
 */
const LEVEL_GUIDE = {
  하: '최대한 세밀하게 끊어. 개별 단어 또는 콜로케이션처럼 함께 쓰이는 최소 의미 단위로 나눠.',
  중: '중간 수준으로 끊어. 주요 명사구·동사구·전치사구 단위로 나눠.',
  상: '크게 끊어. 주절·종속절·부사구처럼 문법적으로 완결된 큰 덩어리 단위로 나눠.',
};

const LEVEL_EXAMPLE = {
  하: {
    chunked: 'The / quick / brown fox / jumps / over / the lazy / dog.',
    translation: 'The / 빠른 / 갈색 여우가 / 뛰어넘는다 / 위를 / 그 게으른 / 개를.',
    grammar: '[관사] / [형용사] / [주어-명사구] / [동사] / [전치사] / [관사+형용사] / [목적어-명사]',
  },
  중: {
    chunked: 'The quick brown fox / jumps over / the lazy dog.',
    translation: '그 빠른 갈색 여우는 / 뛰어넘는다 / 그 게으른 개를.',
    grammar: '[주어-명사구] / [동사구] / [목적어-명사구]',
  },
  상: {
    chunked: 'The quick brown fox jumps over the lazy dog / near the river.',
    translation: '그 빠른 갈색 여우가 그 게으른 개 위를 뛰어넘는다 / 강 근처에서.',
    grammar: '[주절 (주어+동사+목적어)] / [장소 부사구]',
  },
};

/**
 * 청킹 시스템 프롬프트 빌드
 */
function buildChunkingPrompt(sentence, level) {
  const guide = LEVEL_GUIDE[level];
  const example = LEVEL_EXAMPLE[level];

  return `당신은 영어 청킹(chunking) 전문 튜터입니다.
청킹이란 영어 문장을 의미 단위로 끊어 읽는 학습법입니다.

[규칙]
- 주어진 문장 하나만 청킹하세요.
- 난이도: ${level} → ${guide}
- 단어 수로 기계적으로 자르지 말고, 문장 구조와 의미 흐름에 따라 자연스럽게 끊으세요.
- 설명이나 추가 텍스트 없이 정확히 아래 3줄 형식만 출력하세요.

[출력 형식 — 반드시 3줄]
1번째 줄: 청킹된 영어 원문 (청크 사이를 " / " 로 구분)
2번째 줄: 각 청크를 순서대로 직독직해한 한국어 (" / " 위치·개수 동일)
3번째 줄: 각 청크의 문법 역할 레이블 (" / " 위치·개수 동일, 예: [주어-명사구] / [동사구])

[출력 예시]
${example.chunked}
${example.translation}
${example.grammar}

[청킹할 문장]
${sentence}`;
}

/**
 * Gemini API 호출 (503 시 fallback)
 */
async function generateWithFallback(prompt) {
  try {
    return await model.generateContent(prompt);
  } catch (err) {
    if (err?.message?.includes('503') || err?.message?.includes('Service Unavailable')) {
      console.warn('[Gemini] 503 → fallback 모델로 재시도');
      return await fallbackModel.generateContent(prompt);
    }
    throw err;
  }
}

/**
 * 단일 문장 청킹 실행
 * @param {string} sentence 청킹할 영어 문장
 * @param {string} level 난이도 (하|중|상)
 * @returns {{ chunkedText: string, directTranslation: string, grammarLabels: string, rawResponse: string }}
 */
export async function chunkSentence(sentence, level) {
  if (!['하', '중', '상'].includes(level)) {
    throw new Error(`지원하지 않는 난이도입니다: ${level} (하|중|상 중 선택)`);
  }

  const prompt = buildChunkingPrompt(sentence, level);
  const result = await generateWithFallback(prompt);
  const rawResponse = (result?.response?.text() || '').trim();

  if (!rawResponse) {
    throw new Error('AI 응답이 비어있습니다.');
  }

  // 3줄 파싱
  const lines = rawResponse.split('\n').filter((l) => l.trim());

  const chunkedText = lines[0]?.trim() || '';
  const directTranslation = lines[1]?.trim() || '';
  const grammarLabels = lines[2]?.trim() || '';

  return { chunkedText, directTranslation, grammarLabels, rawResponse };
}
