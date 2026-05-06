import { PDFParse } from 'pdf-parse';

/**
 * Buffer에서 PDF 텍스트 추출
 * @param {Buffer} buffer PDF 파일 버퍼
 * @returns {{ text: string, pages: number }}
 */
export async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return {
    text: result.text || '',
    pages: result.total || 0,
  };
}

/**
 * PDF 텍스트를 페이지 단위로 분리
 * @param {Buffer} buffer PDF 파일 버퍼
 * @returns {string[]} 페이지별 텍스트 배열
 */
export async function extractTextByPage(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  if (result.pages && result.pages.length > 0) {
    return result.pages.map((p) => p.text || '');
  }

  return [result.text || ''];
}
