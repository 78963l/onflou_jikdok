import { NextResponse } from 'next/server';

// POST /api/admin/tools/grammar - LanguageTool 무료 API로 영어 문법 검사
export async function POST(request) {
  try {
    const { sentence } = await request.json();

    if (!sentence?.trim()) {
      return NextResponse.json({ error: '문장을 입력해주세요.' }, { status: 400 });
    }

    const body = new URLSearchParams({
      language: 'en-US',
      text: sentence.trim(),
    });

    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`LanguageTool API 오류: ${res.status}`);
    }

    const data = await res.json();

    const matches = (data.matches || []).map((m) => ({
      message: m.message,
      offset: m.offset,
      length: m.length,
      context: m.context?.text || '',
      suggestions: (m.replacements || []).slice(0, 3).map((r) => r.value),
      ruleId: m.rule?.id || '',
      category: m.rule?.category?.name || '',
    }));

    return NextResponse.json({
      success: true,
      isValid: matches.length === 0,
      errorCount: matches.length,
      matches,
    });
  } catch (err) {
    console.error('[문법 검사] 오류:', err);
    return NextResponse.json({ error: `서버 오류: ${err.message}` }, { status: 500 });
  }
}
