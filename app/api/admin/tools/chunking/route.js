import { NextResponse } from 'next/server';
import { chunkSentence } from '@/lib/gemini';

// POST /api/admin/tools/chunking - DB 저장 없이 바로 청킹 결과 반환
export async function POST(request) {
  try {
    const { sentence, level } = await request.json();

    if (!sentence?.trim()) {
      return NextResponse.json({ error: '문장을 입력해주세요.' }, { status: 400 });
    }
    if (!['하', '중', '상'].includes(level)) {
      return NextResponse.json({ error: '난이도는 하|중|상 중 하나여야 합니다.' }, { status: 400 });
    }

    const result = await chunkSentence(sentence.trim(), level);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[빠른 청킹] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}
