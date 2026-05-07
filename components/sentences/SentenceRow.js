'use client';

import { useState, useEffect } from 'react';

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'chunked', label: '청킹 완료' },
  { value: 'reviewed', label: '검토 완료' },
];

const LEVEL_STYLE = {
  하: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '하' },
  중: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', label: '중' },
  상: { badge: 'bg-red-50 text-red-700 border border-red-200', label: '상' },
};

const STATUS_STYLE = {
  pending: 'bg-zinc-100 text-zinc-500',
  chunked: 'bg-green-50 text-green-700',
  reviewed: 'bg-blue-50 text-blue-700',
};

const taClass =
  'w-full border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 resize-y bg-white';

export default function SentenceRow({
  sentence,
  isSelected,
  onSelectToggle,
  onSave,
  onChunk,
  saving,
  chunking,
}) {
  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(sentence.original_text);
  const [localStatus, setLocalStatus] = useState(sentence.status);

  const chunkingByLevel = {};
  for (const cr of sentence.chunking_results || []) {
    if (!chunkingByLevel[cr.level]) chunkingByLevel[cr.level] = cr;
  }

  const [localChunks, setLocalChunks] = useState(
    Object.fromEntries(
      Object.entries(chunkingByLevel).map(([level, cr]) => [
        level,
        {
          id: cr.id,
          chunked_text: cr.chunked_text || '',
          direct_translation: cr.direct_translation || '',
          grammar_labels: cr.grammar_labels || '',
        },
      ])
    )
  );

  // sentence.chunking_results가 변경될 때마다 localChunks 업데이트 (수정 중이 아닐 때만)
  useEffect(() => {
    if (editing) return; // 수정 중일 때는 업데이트하지 않음
    
    const updatedChunkingByLevel = {};
    for (const cr of sentence.chunking_results || []) {
      if (!updatedChunkingByLevel[cr.level]) updatedChunkingByLevel[cr.level] = cr;
    }
    
    const updatedChunks = Object.fromEntries(
      Object.entries(updatedChunkingByLevel).map(([level, cr]) => [
        level,
        {
          id: cr.id,
          chunked_text: cr.chunked_text || '',
          direct_translation: cr.direct_translation || '',
          grammar_labels: cr.grammar_labels || '',
        },
      ])
    );
    setLocalChunks(updatedChunks);
  }, [sentence.chunking_results, editing]);

  function handleSave() {
    onSave({ id: sentence.id, original_text: localText, status: localStatus, localChunks });
    setEditing(false);
  }

  function handleCancel() {
    setLocalText(sentence.original_text);
    setLocalStatus(sentence.status);
    setEditing(false);
  }

  const statusObj = STATUS_OPTIONS.find((s) => s.value === localStatus) || STATUS_OPTIONS[0];
  const levels = ['하', '중', '상'];
  const hasAnyChunk = Object.keys(chunkingByLevel).length > 0;

  return (
    <tr
      onClick={!editing ? onSelectToggle : undefined}
      className={`border-b border-zinc-100 transition-colors select-none ${
        editing ? '' : 'cursor-pointer'
      } ${editing ? 'bg-blue-50/40' : isSelected ? 'bg-zinc-100/60' : 'hover:bg-zinc-50'}`}
    >
      {/* 체크박스 */}
      <td className="px-3 py-2.5 text-center align-top" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelectToggle}
          className="w-3.5 h-3.5 accent-zinc-800 cursor-pointer"
        />
      </td>

      {/* ID */}
      <td className="px-3 py-2.5 align-top">
        <span className="text-xs text-zinc-400 font-mono">{sentence.id}</span>
      </td>

      {/* 교재 */}
      <td className="px-3 py-2.5 align-top">
        <div className="text-xs font-medium text-zinc-700 whitespace-nowrap">{sentence.textbook?.title}</div>
        <div className="text-xs text-zinc-400">{sentence.textbook?.grade} · p.{sentence.page_no}</div>
      </td>

      {/* 원문 */}
      <td className="px-3 py-2.5 align-top min-w-60 select-text cursor-text" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <textarea
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            rows={3}
            className={taClass}
          />
        ) : (
          <p className="text-sm text-zinc-800 leading-relaxed">{sentence.original_text}</p>
        )}
      </td>

      {/* 청킹 결과 */}
      <td className="px-3 py-2.5 align-top min-w-64 select-text cursor-text" onClick={(e) => e.stopPropagation()}>
        {!hasAnyChunk && !editing ? (
          <span className="text-xs text-zinc-300">-</span>
        ) : (
          <div className="space-y-3">
            {levels.map((level) => {
              const chunk = localChunks[level] || chunkingByLevel[level];
              if (!chunk && !editing) return null;

              return (
                <div key={level}>
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded mb-1 font-medium ${LEVEL_STYLE[level].badge}`}>
                    {level}
                  </span>
                  {editing && localChunks[level] ? (
                    <div className="space-y-1 mt-1">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">청킹</p>
                        <textarea value={localChunks[level].chunked_text} rows={2} className={taClass}
                          onChange={(e) => setLocalChunks((p) => ({ ...p, [level]: { ...p[level], chunked_text: e.target.value } }))} />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">직독직해</p>
                        <textarea value={localChunks[level].direct_translation} rows={2} className={taClass}
                          onChange={(e) => setLocalChunks((p) => ({ ...p, [level]: { ...p[level], direct_translation: e.target.value } }))} />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">문법 역할</p>
                        <textarea value={localChunks[level].grammar_labels} rows={2} className={taClass}
                          onChange={(e) => setLocalChunks((p) => ({ ...p, [level]: { ...p[level], grammar_labels: e.target.value } }))} />
                      </div>
                    </div>
                  ) : chunk ? (
                    <div className="space-y-0.5 text-xs">
                      <div className="text-zinc-800 font-mono leading-relaxed">{chunk.chunked_text}</div>
                      <div className="text-zinc-500">{chunk.direct_translation}</div>
                      <div className="text-purple-500">{chunk.grammar_labels}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </td>

      {/* 상태 */}
      <td className="px-3 py-2.5 align-top whitespace-nowrap">
        {editing ? (
          <select
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value)}
            className="border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[localStatus] || STATUS_STYLE.pending}`}>
            {statusObj.label}
          </span>
        )}
      </td>

      {/* 액션 */}
      <td className="px-3 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-400 disabled:cursor-not-allowed cursor-pointer text-white text-xs rounded transition-colors"
              >
                {saving ? '저장 중' : '저장'}
              </button>
              <button
                onClick={handleCancel}
                className="px-2.5 py-1 border border-zinc-300 text-zinc-600 text-xs rounded hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                취소
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 border border-zinc-300 text-zinc-600 text-xs rounded hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              수정
            </button>
          )}

          <ChunkButtons sentenceId={sentence.id} onChunk={onChunk} chunking={chunking} />
        </div>
      </td>
    </tr>
  );
}

function ChunkButtons({ sentenceId, onChunk, chunking }) {
  return (
    <div className="flex flex-col gap-1 mt-0.5">
      {['하', '중', '상'].map((level) => {
        const isLoading = chunking === `${sentenceId}-${level}`;
        return (
          <button
            key={level}
            onClick={() => onChunk(sentenceId, level)}
            disabled={!!chunking}
            className={`px-2 py-0.5 text-xs rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${LEVEL_STYLE[level].badge} hover:opacity-80`}
          >
            {isLoading ? '...' : `청킹 ${level}`}
          </button>
        );
      })}
    </div>
  );
}
