'use client';

const selectClass =
  'border border-zinc-300 rounded px-2.5 py-1.5 text-sm text-zinc-900 bg-white focus:outline-none focus:border-zinc-500';

export default function FilterBar({ textbooks, filters, onChange }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3 mb-3 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">교재</label>
        <select
          value={filters.textbook_id}
          onChange={(e) => onChange({ ...filters, textbook_id: e.target.value, page: 1 })}
          className={selectClass}
          style={{ minWidth: 160 }}
        >
          <option value="">전체 교재</option>
          {textbooks.map((tb) => (
            <option key={tb.id} value={tb.id}>
              {tb.title} ({tb.grade})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">상태</label>
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value, page: 1 })}
          className={selectClass}
        >
          <option value="">전체</option>
          <option value="pending">대기</option>
          <option value="chunked">청킹 완료</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">난이도</label>
        <select
          value={filters.level}
          onChange={(e) => onChange({ ...filters, level: e.target.value, page: 1 })}
          className={selectClass}
        >
          <option value="">전체</option>
          <option value="하">하</option>
          <option value="중">중</option>
          <option value="상">상</option>
        </select>
      </div>

      <button
        onClick={() => onChange({ textbook_id: '', status: '', level: '', page: 1 })}
        className="px-3 py-1.5 text-sm text-zinc-500 border border-zinc-300 rounded hover:bg-zinc-50 transition-colors"
      >
        초기화
      </button>
    </div>
  );
}
