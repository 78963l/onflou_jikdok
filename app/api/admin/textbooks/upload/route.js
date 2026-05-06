import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { extractTextByPage } from '@/lib/pdfParser';
import { extractSentencesWithPageInfo, filterByGrammar } from '@/lib/sentenceExtractor';

export async function POST(request) {
  try {
    const formData = await request.formData();

    const file = formData.get('file');
    const title = formData.get('title');
    const grade = formData.get('grade');
    const unit_name = formData.get('unit_name');

    // 입력값 검증
    if (!file || !title || !grade || !unit_name) {
      return NextResponse.json(
        { error: '파일, 교재명, 학년, 단원명은 필수입니다.' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF 파일만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 파일 버퍼 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // 파일명 충돌 방지를 위해 타임스탬프 추가
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    // 파일 저장
    await writeFile(filePath, buffer);

    // PDF 텍스트 추출 (페이지별)
    const pageTexts = await extractTextByPage(buffer);

    // 영어 문장 추출
    const rawSentences = extractSentencesWithPageInfo(pageTexts);

    // LanguageTool 문법 검사 (API 1회 호출로 전체 처리)
    const extractedSentences = await filterByGrammar(rawSentences);

    if (extractedSentences.length === 0) {
      return NextResponse.json(
        { error: 'PDF에서 영어 문장을 추출하지 못했습니다. 파일 내용을 확인해주세요.' },
        { status: 422 }
      );
    }

    // DB 트랜잭션으로 교재 + 문장 일괄 저장
    const textbook = await prisma.$transaction(async (tx) => {
      // 교재 저장
      const newTextbook = await tx.textbook.create({
        data: {
          title,
          grade,
          unit_name,
          original_file_name: file.name,
          file_path: `uploads/${fileName}`,
        },
      });

      // 문장 일괄 저장
      await tx.textbookSentence.createMany({
        data: extractedSentences.map(({ pageNo, sentence, order }) => ({
          textbook_id: newTextbook.id,
          page_no: pageNo,
          sentence_order: order,
          original_text: sentence,
          detected_type: 'english',
          status: 'pending',
        })),
      });

      return newTextbook;
    });

    return NextResponse.json({
      success: true,
      textbook_id: textbook.id,
      sentence_count: extractedSentences.length,
      message: `교재가 저장되었습니다. 총 ${extractedSentences.length}개의 영어 문장이 추출되었습니다.`,
    });
  } catch (err) {
    console.error('[PDF 업로드] 오류:', err);
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${err.message}` },
      { status: 500 }
    );
  }
}
