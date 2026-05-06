import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { chunkSentence } from '@/lib/gemini';

// POST /api/admin/sentences/[id]/chunking - 단일 문장 청킹
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const sentenceId = parseInt(id, 10);

    if (isNaN(sentenceId)) {
      return NextResponse.json({ error: '유효하지 않은 문장 ID입니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { level } = body;

    if (!level || !['하', '중', '상'].includes(level)) {
      return NextResponse.json(
        { error: '난이도는 하|중|상 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    // 문장 조회
    const sentence = await prisma.textbookSentence.findUnique({
      where: { id: sentenceId },
    });

    if (!sentence) {
      return NextResponse.json({ error: '문장을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Gemini 청킹 실행
    const { chunkedText, directTranslation, grammarLabels, rawResponse } =
      await chunkSentence(sentence.original_text, level);

    // 같은 sentence_id + level 조합이 있으면 upsert
    const existingChunk = await prisma.chunkingResult.findFirst({
      where: { sentence_id: sentenceId, level },
    });

    let chunkingResult;
    if (existingChunk) {
      chunkingResult = await prisma.chunkingResult.update({
        where: { id: existingChunk.id },
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
          sentence_id: sentenceId,
          level,
          chunked_text: chunkedText,
          direct_translation: directTranslation,
          grammar_labels: grammarLabels,
          ai_raw_response: rawResponse,
        },
      });
    }

    // 문장 상태를 chunked로 업데이트
    await prisma.textbookSentence.update({
      where: { id: sentenceId },
      data: { status: 'chunked' },
    });

    return NextResponse.json({
      success: true,
      chunking_result: chunkingResult,
    });
  } catch (err) {
    console.error('[청킹] 오류:', err);
    return NextResponse.json(
      { error: `서버 오류: ${err.message}` },
      { status: 500 }
    );
  }
}
