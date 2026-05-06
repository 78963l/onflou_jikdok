import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { chunkSentence } from '@/lib/gemini';

// POST /api/admin/sentences/bulk-chunking - 여러 문장 일괄 청킹
export async function POST(request) {
  try {
    const body = await request.json();
    const { sentence_ids, level } = body;

    if (!Array.isArray(sentence_ids) || sentence_ids.length === 0) {
      return NextResponse.json(
        { error: '문장 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!level || !['하', '중', '상'].includes(level)) {
      return NextResponse.json(
        { error: '난이도는 하|중|상 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    // 최대 30개 제한 (API 과부하 방지)
    if (sentence_ids.length > 30) {
      return NextResponse.json(
        { error: '한 번에 최대 30개까지 처리할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 문장 목록 조회
    const sentences = await prisma.textbookSentence.findMany({
      where: { id: { in: sentence_ids.map(Number) } },
    });

    const results = [];
    const errors = [];

    // 순차 처리 (Gemini API 레이트리밋 고려)
    for (const sentence of sentences) {
      try {
        const { chunkedText, directTranslation, grammarLabels, rawResponse } =
          await chunkSentence(sentence.original_text, level);

        // 기존 결과 확인 후 upsert
        const existing = await prisma.chunkingResult.findFirst({
          where: { sentence_id: sentence.id, level },
        });

        let chunkingResult;
        if (existing) {
          chunkingResult = await prisma.chunkingResult.update({
            where: { id: existing.id },
            data: {
              chunked_text: chunkedText,
              direct_translation: directTranslation,
              grammar_labels: grammarLabels,
              ai_raw_response: rawResponse,
            },
          });
        } else {
          chunkingResult = await prisma.chunkingResult.create({
            data: {
              sentence_id: sentence.id,
              level,
              chunked_text: chunkedText,
              direct_translation: directTranslation,
              grammar_labels: grammarLabels,
              ai_raw_response: rawResponse,
            },
          });
        }

        // 상태 업데이트
        await prisma.textbookSentence.update({
          where: { id: sentence.id },
          data: { status: 'chunked' },
        });

        results.push({ sentence_id: sentence.id, success: true, chunking_result: chunkingResult });

        // API 레이트리밋 방지 (200ms 딜레이)
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`[일괄 청킹] 문장 ${sentence.id} 처리 실패:`, err);
        errors.push({ sentence_id: sentence.id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (err) {
    console.error('[일괄 청킹] 오류:', err);
    return NextResponse.json(
      { error: `서버 오류: ${err.message}` },
      { status: 500 }
    );
  }
}
