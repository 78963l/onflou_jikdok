'use client';

import { useState, useEffect, useCallback } from 'react';
import FilterBar from '@/components/sentences/FilterBar';
import SentenceRow from '@/components/sentences/SentenceRow';

export default function SentencesPage() {
  const [sentences, setSentences] = useState([]);
  const [textbooks, setTextbooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [limit, setLimit] = useState(50);
  const [filters, setFilters] = useState({ textbook_id: '', status: '', level: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [chunkingKey, setChunkingKey] = useState(null);
  const [bulkLevel, setBulkLevel] = useState('중');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkStatus, setBulkStatus] = useState('pending');

  useEffect(() => {
    fetch('/api/admin/textbooks')
      .then((r) => r.json())
      .then((d) => setTextbooks(d.textbooks || []));
  }, []);

  const fetchSentences = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setSelectedIds([]);
    }
    const params = new URLSearchParams();
    if (filters.textbook_id) params.set('textbook_id', filters.textbook_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.level) params.set('level', filters.level);
    params.set('page', filters.page);
    params.set('limit', limit);
    try {
      const res = await fetch(`/api/admin/sentences?${params}`);
      const data = await res.json();
      const scrollY = window.scrollY;
      setSentences(data.sentences || []);
      setPagination((prev) => ({ ...prev, ...data.pagination }));
      if (silent) {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
      }
    } catch (e) {
      console.error('문장 목록 조회 실패:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, limit]);

  useEffect(() => { fetchSentences(); }, [fetchSentences]);

  function toggleSelectAll() {
    setSelectedIds(selectedIds.length === sentences.length ? [] : sentences.map((s) => s.id));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSave({ id, original_text, status, localChunks }) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/sentences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_text, status }),
      });
      if (!res.ok) { const d = await res.json(); alert(`저장 실패: ${d.error}`); return; }

      for (const [level, chunk] of Object.entries(localChunks)) {
        if (!chunk.id) continue;
        await fetch(`/api/admin/sentences/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunking_result: { id: chunk.id, level, chunked_text: chunk.chunked_text, direct_translation: chunk.direct_translation, grammar_labels: chunk.grammar_labels } }),
        });
      }
      await fetchSentences({ silent: true });
    } catch (e) {
      alert(`저장 오류: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleChunk(sentenceId, level) {
    const key = `${sentenceId}-${level}`;
    setChunkingKey(key);
    try {
      const res = await fetch(`/api/admin/sentences/${sentenceId}/chunking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`청킹 실패: ${data.error}`); return; }
      await fetchSentences({ silent: true });
    } catch (e) {
      alert(`청킹 오류: ${e.message}`);
    } finally {
      setChunkingKey(null);
    }
  }

  async function handleBulkStatusChange() {
    if (selectedIds.length === 0) return alert('수정할 문장을 선택하세요.');
    try {
      const res = await fetch('/api/admin/sentences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence_ids: selectedIds, status: bulkStatus }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`상태 변경 실패: ${data.error}`); return; }
      setSelectedIds([]);
      await fetchSentences({ silent: true });
    } catch (e) {
      alert(`상태 변경 오류: ${e.message}`);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return alert('삭제할 문장을 선택하세요.');
    if (!confirm(`선택한 ${selectedIds.length}개 문장을 삭제하시겠습니까?\n청킹 결과도 함께 삭제됩니다.`)) return;

    try {
      const res = await fetch('/api/admin/sentences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence_ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`삭제 실패: ${data.error}`); return; }
      setSelectedIds([]);
      await fetchSentences({ silent: true });
    } catch (e) {
      alert(`삭제 오류: ${e.message}`);
    }
  }

  async function handleBulkChunk() {
    if (selectedIds.length === 0) return alert('청킹할 문장을 선택하세요.');
    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/admin/sentences/bulk-chunking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence_ids: selectedIds, level: bulkLevel }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`일괄 청킹 실패: ${data.error}`); return; }
      setBulkResult(data);
      setSelectedIds([]);
      await fetchSentences({ silent: true });
    } catch (e) {
      alert(`일괄 청킹 오류: ${e.message}`);
    } finally {
      setBulkProcessing(false);
    }
  }

  const allSelected = sentences.length > 0 && selectedIds.length === sentences.length;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-zinc-900">문장 관리</h1>
        <p className="text-sm text-zinc-500 mt-0.5">문장 조회, 수정, AI 청킹</p>
      </div>

      <FilterBar textbooks={textbooks} filters={filters} onChange={setFilters} />

      {/* 일괄 청킹 바 */}
      <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2.5 mb-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-500">
          {selectedIds.length > 0 ? `${selectedIds.length}개 선택` : '문장 선택 후 일괄 청킹 가능'}
        </span>

        <select
          value={bulkLevel}
          onChange={(e) => setBulkLevel(e.target.value)}
          className="border border-zinc-300 rounded px-2.5 py-1 text-sm text-zinc-900 bg-white focus:outline-none focus:border-zinc-500"
        >
          <option value="하">난이도 하</option>
          <option value="중">난이도 중</option>
          <option value="상">난이도 상</option>
        </select>

        <button
          onClick={handleBulkChunk}
          disabled={bulkProcessing || selectedIds.length === 0}
          className="px-3 py-1 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-xs rounded transition-colors"
        >
          {bulkProcessing ? `처리 중...` : `일괄 청킹 (${selectedIds.length}개)`}
        </button>

        <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-3">
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-900 bg-white focus:outline-none focus:border-zinc-500"
          >
            <option value="pending">대기</option>
            <option value="chunked">청킹 완료</option>
            <option value="reviewed">검토 완료</option>
          </select>
          <button
            onClick={handleBulkStatusChange}
            disabled={selectedIds.length === 0}
            className="px-3 py-1 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-xs rounded transition-colors"
          >
            상태 변경 ({selectedIds.length}개)
          </button>
        </div>

        <button
          onClick={handleBulkDelete}
          disabled={selectedIds.length === 0}
          className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-zinc-300 text-white text-xs rounded transition-colors"
        >
          삭제 ({selectedIds.length}개)
        </button>

        {bulkResult && (
          <span className="text-xs text-green-600">
            완료 {bulkResult.processed}개{bulkResult.failed > 0 ? ` / 실패 ${bulkResult.failed}개` : ''}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-400">총 {pagination.total}개</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setFilters((p) => ({ ...p, page: 1 })); }}
            className="border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-900 bg-white focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            <option value={10}>10개씩</option>
            <option value={50}>50개씩</option>
            <option value={100}>100개씩</option>
            <option value={200}>200개씩</option>
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-14 text-center text-sm text-zinc-400">불러오는 중...</div>
        ) : sentences.length === 0 ? (
          <div className="py-14 text-center text-sm text-zinc-400">조건에 맞는 문장이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-zinc-800"
                    />
                  </th>
                  {['ID', '교재', '원문', '청킹 / 직독직해 / 문법', '상태', '액션'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sentences.map((sentence) => (
                  <SentenceRow
                    key={sentence.id}
                    sentence={sentence}
                    isSelected={selectedIds.includes(sentence.id)}
                    onSelectToggle={() => toggleSelect(sentence.id)}
                    onSave={handleSave}
                    onChunk={handleChunk}
                    saving={savingId === sentence.id}
                    chunking={chunkingKey}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <button
            onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
            disabled={filters.page <= 1}
            className="px-3 py-1.5 border border-zinc-300 rounded text-sm text-zinc-600 disabled:opacity-30 hover:bg-zinc-50"
          >
            이전
          </button>

          {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setFilters((p) => ({ ...p, page }))}
                className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                  filters.page === page
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
            disabled={filters.page >= pagination.totalPages}
            className="px-3 py-1.5 border border-zinc-300 rounded text-sm text-zinc-600 disabled:opacity-30 hover:bg-zinc-50"
          >
            다음
          </button>

          <span className="text-xs text-zinc-400 ml-1">
            {filters.page} / {pagination.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
