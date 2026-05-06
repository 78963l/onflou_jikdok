'use client';

import { useState, useEffect } from 'react';

const LEVEL_STYLE = {
  하: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', btn: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  중: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', btn: 'bg-amber-50 text-amber-700 border-amber-200' },
  상: { badge: 'bg-red-50 text-red-700 border border-red-200', btn: 'bg-red-50 text-red-700 border-red-200' },
};

export default function ToolsPage() {
  const [textbooks, setTextbooks] = useState([]);

  // 청킹 테스트
  const [sentence, setSentence] = useState('');
  const [level, setLevel] = useState('중');
  const [chunkLoading, setChunkLoading] = useState(false);
  const [chunkResult, setChunkResult] = useState(null);
  const [chunkError, setChunkError] = useState('');

  // 문법 검사
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [grammarResult, setGrammarResult] = useState(null);
  const [grammarError, setGrammarError] = useState('');

  // 등록 폼
  const [regTextbookId, setRegTextbookId] = useState('');
  const [regPageNo, setRegPageNo] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regResult, setRegResult] = useState(null);
  const [regError, setRegError] = useState('');

  // 기타 교재 직접 입력
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newUnit, setNewUnit] = useState('');

  useEffect(() => {
    fetch('/api/admin/textbooks')
      .then((r) => r.json())
      .then((d) => {
        setTextbooks(d.textbooks || []);
        if (d.textbooks?.length > 0) setRegTextbookId(String(d.textbooks[0].id));
      });
  }, []);

  async function handleGrammar() {
    if (!sentence.trim()) return;
    setGrammarLoading(true);
    setGrammarResult(null);
    setGrammarError('');
    try {
      const res = await fetch('/api/admin/tools/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      });
      const data = await res.json();
      if (!res.ok) { setGrammarError(data.error || '검사 실패'); return; }
      setGrammarResult(data);
    } catch (e) {
      setGrammarError(`오류: ${e.message}`);
    } finally {
      setGrammarLoading(false);
    }
  }

  async function handleChunk(e) {
    e.preventDefault();
    if (!sentence.trim()) return;
    setChunkLoading(true);
    setChunkResult(null);
    setChunkError('');
    setRegResult(null);
    try {
      const res = await fetch('/api/admin/tools/chunking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence, level }),
      });
      const data = await res.json();
      if (!res.ok) { setChunkError(data.error || '청킹 실패'); return; }
      setChunkResult({ ...data, level });
    } catch (e) {
      setChunkError(`오류: ${e.message}`);
    } finally {
      setChunkLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!sentence.trim()) return;
    setRegLoading(true);
    setRegResult(null);
    setRegError('');
    try {
      let textbookId = regTextbookId;

      // 기타 선택 시 교재 먼저 생성
      if (regTextbookId === '__new__') {
        if (!newTitle.trim() || !newGrade.trim() || !newUnit.trim()) {
          setRegError('교재명, 학년, 단원명을 모두 입력해주세요.'); return;
        }
        const tbRes = await fetch('/api/admin/textbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle, grade: newGrade, unit_name: newUnit }),
        });
        const tbData = await tbRes.json();
        if (!tbRes.ok) { setRegError(tbData.error || '교재 생성 실패'); return; }
        textbookId = String(tbData.textbook.id);
        // 목록 갱신
        const listRes = await fetch('/api/admin/textbooks').then((r) => r.json());
        setTextbooks(listRes.textbooks || []);
        setRegTextbookId(textbookId);
        setNewTitle(''); setNewGrade(''); setNewUnit('');
      }

      const res = await fetch('/api/admin/sentences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textbook_id: textbookId,
          sentence,
          page_no: regPageNo,
          chunking: chunkResult ? {
            level: chunkResult.level,
            chunkedText: chunkResult.chunkedText,
            directTranslation: chunkResult.directTranslation,
            grammarLabels: chunkResult.grammarLabels,
            rawResponse: chunkResult.rawResponse,
          } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || '등록 실패'); return; }
      setRegResult(data.sentence);
      setSentence('');
      setChunkResult(null);
      setRegPageNo('');
    } catch (e) {
      setRegError(`오류: ${e.message}`);
    } finally {
      setRegLoading(false);
    }
  }

  const selectedTextbook = textbooks.find((tb) => String(tb.id) === regTextbookId);

  return (
    <div className="p-6 w-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">문장 도구</h1>
        <p className="text-sm text-zinc-500 mt-0.5">청킹 테스트 후 바로 문장 등록</p>
      </div>

      {/* STEP 1 — 청킹 테스트 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center font-medium shrink-0">1</span>
          <h2 className="text-sm font-medium text-zinc-700">문장 입력 및 청킹</h2>
        </div>

        <form onSubmit={handleChunk}>
          <div className="mb-3">
            <textarea
              value={sentence}
              onChange={(e) => { setSentence(e.target.value); setChunkResult(null); setRegResult(null); }}
              placeholder="She went to Europe to travel."
              rows={3}
              className="w-full border border-zinc-300 rounded px-2.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {['하', '중', '상'].map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`px-3 py-1 text-xs rounded border transition-colors cursor-pointer ${level === lv ? LEVEL_STYLE[lv].badge : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'
                    }`}
                >
                  난이도 {lv}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleGrammar}
              disabled={grammarLoading || !sentence.trim()}
              className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs rounded hover:bg-zinc-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              {grammarLoading ? '검사 중...' : '문법 검사'}
            </button>
            <button
              type="submit"
              disabled={chunkLoading || !sentence.trim()}
              className="ml-auto px-4 py-1.5 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {chunkLoading ? '청킹 중...' : '청킹'}
            </button>
          </div>
        </form>

        {grammarError && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {grammarError}
          </div>
        )}

        {grammarResult && (
          <div className={`mt-3 border rounded-lg overflow-hidden ${grammarResult.isValid ? 'border-green-200' : 'border-amber-200'}`}>
            <div className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${grammarResult.isValid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {grammarResult.isValid ? '✓ 문법 오류 없음' : `문법 오류 ${grammarResult.errorCount}건`}
              <span className="text-xs font-normal opacity-60 ml-auto">LanguageTool</span>
            </div>
            {!grammarResult.isValid && (
              <div className="divide-y divide-zinc-100">
                {grammarResult.matches.map((m, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <p className="text-xs font-medium text-zinc-700 mb-0.5">{m.message}</p>
                    <p className="text-xs text-zinc-400 font-mono mb-1">…{m.context}…</p>
                    {m.suggestions.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-xs text-zinc-400">제안:</span>
                        {m.suggestions.map((s, j) => (
                          <span key={j} className="text-xs bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-mono">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {chunkError && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {chunkError}
          </div>
        )}

        {/* 청킹 결과 */}
        {chunkResult && (
          <div className="mt-4 border border-zinc-100 rounded-lg overflow-hidden">
            <div className={`px-3 py-1.5 text-xs font-medium border-b ${LEVEL_STYLE[chunkResult.level].badge}`}>
              난이도 {chunkResult.level} 청킹 결과
            </div>
            <div className="p-4 space-y-2.5">
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">청킹</p>
                <p className="text-sm font-mono text-zinc-900 leading-relaxed">{chunkResult.chunkedText}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">직독직해</p>
                <p className="text-sm text-zinc-700 leading-relaxed">{chunkResult.directTranslation}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">문법 역할</p>
                <p className="text-sm text-purple-600 leading-relaxed">{chunkResult.grammarLabels}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2 — 등록 */}
      <div className={`bg-white border rounded-lg p-5 transition-colors ${chunkResult ? 'border-zinc-900' : 'border-zinc-200'
        }`}>
        <div className="flex items-center gap-2 mb-4">
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium shrink-0 ${chunkResult ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'
            }`}>2</span>
          <h2 className="text-sm font-medium text-zinc-700">교재 선택 및 등록</h2>
          {chunkResult && (
            <span className="ml-auto text-xs text-zinc-400">청킹 결과가 함께 저장됩니다</span>
          )}
        </div>

        <form onSubmit={handleRegister}>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="col-span-3">
              <label className="block text-xs text-zinc-500 mb-1">교재</label>
              <select
                value={regTextbookId}
                onChange={(e) => setRegTextbookId(e.target.value)}
                className="w-full border border-zinc-300 rounded px-2.5 py-1.5 text-sm text-zinc-900 bg-white focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                {textbooks.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.title} ({tb.grade} · {tb.unit_name})
                  </option>
                ))}
                <option value="__new__">＋ 기타 (직접 입력)</option>
              </select>
              {selectedTextbook && (
                <p className="text-xs text-zinc-400 mt-1">현재 {selectedTextbook._count?.sentences ?? 0}개 문장 등록됨</p>
              )}

              {/* 기타 선택 시 입력 폼 */}
              {regTextbookId === '__new__' && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="교재명"
                    className="border border-zinc-300 rounded px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
                  />
                  <input
                    type="text"
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    placeholder="학년 (예: 고1)"
                    className="border border-zinc-300 rounded px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
                  />
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="단원명"
                    className="border border-zinc-300 rounded px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">페이지</label>
              <input
                type="number"
                value={regPageNo}
                onChange={(e) => setRegPageNo(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full border border-zinc-300 rounded px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* 등록할 문장 미리보기 */}
          {sentence.trim() && (
            <div className="mb-3 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-600">
              <span className="text-zinc-400 mr-1">등록될 문장:</span>{sentence.trim()}
            </div>
          )}

          {regError && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {regError}
            </div>
          )}
          {regResult && (
            <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              등록 완료 — ID {regResult.id} · {chunkResult ? '청킹 결과 포함' : '청킹 없음'}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={regLoading || !sentence.trim() || !regTextbookId}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {regLoading ? '등록 중...' : chunkResult ? '문장 + 청킹 결과 등록' : '문장 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
