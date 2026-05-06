import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/admin/sentences - 문장 목록 조회 (필터 지원)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const textbook_id = searchParams.get('textbook_id');
    const status = searchParams.get('status');
    const level = searchParams.get('level');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const skip = (page - 1) * limit;

    // 필터 조건 조합
    const where = {};
    if (textbook_id) where.textbook_id = parseInt(textbook_id, 10);
    if (status) where.status = status;

    // 난이도 필터는 chunking_results 기준으로 필터링
    const includeChunking = {
      chunking_results: {
        orderBy: { created_at: 'desc' },
        take: 3, // 하/중/상 최신 결과
      },
    };

    if (level) {
      includeChunking.chunking_results = {
        where: { level },
        orderBy: { created_at: 'desc' },
        take: 1,
      };
      // 해당 난이도 청킹이 있는 문장만 필터
      where.chunking_results = { some: { level } };
    }

    const [sentences, total] = await Promise.all([
      prisma.textbookSentence.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ textbook_id: 'asc' }, { sentence_order: 'asc' }],
        include: {
          textbook: { select: { id: true, title: true, grade: true, unit_name: true } },
          ...includeChunking,
        },
      }),
      prisma.textbookSentence.count({ where }),
    ]);

    return NextResponse.json({
      sentences,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[문장 목록] 오류:', err);
    return NextResponse.json(
      { error: `서버 오류: ${err.message}` },
      { status: 500 }
    );
  }
}

// POST /api/admin/sentences - 문장 개별 등록 (청킹 결과 포함 가능)
export async function POST(request) {
  try {
    const { textbook_id, sentence, page_no, chunking } = await request.json();

    if (!textbook_id || !sentence?.trim()) {
      return NextResponse.json({ error: '교재와 문장을 입력해주세요.' }, { status: 400 });
    }

    const textbook = await prisma.textbook.findUnique({ where: { id: parseInt(textbook_id, 10) } });
    if (!textbook) {
      return NextResponse.json({ error: '교재를 찾을 수 없습니다.' }, { status: 404 });
    }

    const lastSentence = await prisma.textbookSentence.findFirst({
      where: { textbook_id: parseInt(textbook_id, 10) },
      orderBy: { sentence_order: 'desc' },
    });

    const newSentence = await prisma.$transaction(async (tx) => {
      const created = await tx.textbookSentence.create({
        data: {
          textbook_id: parseInt(textbook_id, 10),
          page_no: parseInt(page_no || 0, 10),
          sentence_order: (lastSentence?.sentence_order ?? -1) + 1,
          original_text: sentence.trim(),
          detected_type: 'english',
          status: chunking ? 'chunked' : 'pending',
        },
      });

      // 청킹 결과가 있으면 함께 저장
      if (chunking?.level && chunking?.chunkedText) {
        await tx.chunkingResult.create({
          data: {
            sentence_id: created.id,
            level: chunking.level,
            chunked_text: chunking.chunkedText,
            direct_translation: chunking.directTranslation || '',
            grammar_labels: chunking.grammarLabels || '',
            ai_raw_response: chunking.rawResponse || '',
          },
        });
      }

      return created;
    });

    return NextResponse.json({ success: true, sentence: newSentence });
  } catch (err) {
    console.error('[문장 등록] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}

// PATCH /api/admin/sentences - 문장 일괄 상태 변경
export async function PATCH(request) {
  try {
    const { sentence_ids, status } = await request.json();

    if (!Array.isArray(sentence_ids) || sentence_ids.length === 0) {
      return NextResponse.json({ error: '수정할 문장 ID가 없습니다.' }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: '변경할 상태값이 없습니다.' }, { status: 400 });
    }

    const { count } = await prisma.textbookSentence.updateMany({
      where: { id: { in: sentence_ids } },
      data: { status },
    });

    return NextResponse.json({ success: true, updated: count });
  } catch (err) {
    console.error('[문장 일괄 수정] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}

// DELETE /api/admin/sentences - 문장 일괄 삭제
export async function DELETE(request) {
  try {
    const { sentence_ids } = await request.json();

    if (!Array.isArray(sentence_ids) || sentence_ids.length === 0) {
      return NextResponse.json({ error: '삭제할 문장 ID가 없습니다.' }, { status: 400 });
    }

    const { count } = await prisma.textbookSentence.deleteMany({
      where: { id: { in: sentence_ids } },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (err) {
    console.error('[문장 일괄 삭제] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}
