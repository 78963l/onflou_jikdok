import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// DELETE /api/admin/textbooks - 교재 일괄 삭제 (문장·청킹 결과 cascade)
export async function DELETE(request) {
  try {
    const { textbook_ids } = await request.json();

    if (!Array.isArray(textbook_ids) || textbook_ids.length === 0) {
      return NextResponse.json({ error: '삭제할 교재 ID가 없습니다.' }, { status: 400 });
    }

    const { count } = await prisma.textbook.deleteMany({
      where: { id: { in: textbook_ids } },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (err) {
    console.error('[교재 삭제] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}

// POST /api/admin/textbooks - 교재 직접 생성 (PDF 없이)
export async function POST(request) {
  try {
    const { title, grade, unit_name } = await request.json();

    if (!title?.trim() || !grade?.trim() || !unit_name?.trim()) {
      return NextResponse.json({ error: '교재명, 학년, 단원명을 모두 입력해주세요.' }, { status: 400 });
    }

    const textbook = await prisma.textbook.create({
      data: {
        title: title.trim(),
        grade: grade.trim(),
        unit_name: unit_name.trim(),
        original_file_name: '',
        file_path: '',
      },
    });

    return NextResponse.json({ success: true, textbook });
  } catch (err) {
    console.error('[교재 생성] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}

// GET /api/admin/textbooks - 교재 목록 조회
export async function GET() {
  try {
    const textbooks = await prisma.textbook.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { sentences: true },
        },
      },
    });

    return NextResponse.json({ textbooks });
  } catch (err) {
    console.error('[교재 목록] 오류:', err);
    return NextResponse.json(
      { error: `서버 오류: ${err.message}` },
      { status: 500 }
    );
  }
}
