import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// PATCH /api/admin/sentences/[id] - 문장 수정
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const sentenceId = parseInt(id, 10);

    if (isNaN(sentenceId)) {
      return NextResponse.json({ error: '유효하지 않은 문장 ID입니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { original_text, status, chunking_result } = body;

    // 문장 존재 여부 확인
    const existing = await prisma.textbookSentence.findUnique({
      where: { id: sentenceId },
    });

    if (!existing) {
      return NextResponse.json({ error: '문장을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 문장 업데이트
    const updateData = {};
    if (original_text !== undefined) updateData.original_text = original_text;
    if (status !== undefined) updateData.status = status;

    const updatedSentence = await prisma.textbookSentence.update({
      where: { id: sentenceId },
      data: updateData,
    });

    // 청킹 결과 수정 (chunking_result.id, chunking_result.level 필요)
    if (chunking_result) {
      const { id: chunkId, level, chunked_text, direct_translation, grammar_labels } = chunking_result;

      if (chunkId) {
        await prisma.chunkingResult.update({
          where: { id: chunkId },
          data: {
            chunked_text,
            direct_translation,
            grammar_labels,
          },
        });
      }
    }

    return NextResponse.json({ success: true, sentence: updatedSentence });
  } catch (err) {
    console.error('[문장 수정] 오류:', err);
    return NextResponse.json(
      { error: `서버 오류: ${err.message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sentences/[id] - 문장 단건 삭제
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const sentenceId = parseInt(id, 10);

    if (isNaN(sentenceId)) {
      return NextResponse.json({ error: '유효하지 않은 문장 ID입니다.' }, { status: 400 });
    }

    await prisma.textbookSentence.delete({ where: { id: sentenceId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[문장 삭제] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}
