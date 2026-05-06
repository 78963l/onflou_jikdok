'use client';

import { useState, useEffect, useRef } from 'react';

export default function TextbooksPage() {
  const [textbooks, setTextbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', grade: '', unit_name: '' });
  const fileInputRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState([]);

  async function fetchTextbooks() {
    try {
      const res = await fetch('/api/admin/textbooks');
      const data = await res.json();
      setTextbooks(data.textbooks || []);
    } catch (e) {
      console.error('교재 목록 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTextbooks(); }, []);

  function toggleSelect(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setSelectedIds(selectedIds.length === textbooks.length ? [] : textbooks.map((tb) => tb.id));
  }

  async function handleDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택한 ${selectedIds.length}개 교재를 삭제하시겠습니까?\n해당 교재의 문장과 청킹 결과가 모두 삭제됩니다.`)) return;

    try {
      const res = await fetch('/api/admin/textbooks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textbook_ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`삭제 실패: ${data.error}`); return; }
      setSelectedIds([]);
      await fetchTextbooks();
    } catch (e) {
      alert(`삭제 오류: ${e.message}`);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setError('');
    setUploadResult(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) return setError('PDF 파일을 선택해주세요.');
    if (!form.title || !form.grade || !form.unit_name) return setError('모든 항목을 입력해주세요.');

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', form.title);
      formData.append('grade', form.grade);
      formData.append('unit_name', form.unit_name);

      const res = await fetch('/api/admin/textbooks/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) return setError(data.error || '업로드 실패');

      setUploadResult(data);
      setForm({ title: '', grade: '', unit_name: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchTextbooks();
    } catch (e) {
      setError(`업로드 오류: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  const allSelected = textbooks.length > 0 && selectedIds.length === textbooks.length;

  return (
    <div className="p-6 w-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">교재 관리</h1>
        <p className="text-sm text-zinc-500 mt-0.5">PDF를 업로드하면 영어 문장을 자동 추출합니다</p>
      </div>

      {/* 업로드 폼 */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 mb-5">
        <h2 className="text-sm font-medium text-zinc-700 mb-4">PDF 업로드</h2>
        <form onSubmit={handleUpload}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">교재명 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="능률 영어 1"
                className="w-full border border-zinc-300 rounded px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">학년 *</label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="고1"
                className="w-full border border-zinc-300 rounded px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">단원명 *</label>
              <input
                type="text"
                value={form.unit_name}
                onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
                placeholder="Unit 1. My Dream"
                className="w-full border border-zinc-300 rounded px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-zinc-500 mb-1">PDF 파일 *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="block w-full text-sm text-zinc-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border file:border-zinc-300 file:bg-zinc-50 file:text-zinc-700 file:text-xs hover:file:bg-zinc-100 file:cursor-pointer"
            />
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}
          {uploadResult && (
            <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              {uploadResult.message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-400 text-white text-sm rounded transition-colors"
            >
              {uploading ? '처리 중...' : '업로드'}
            </button>
          </div>
        </form>
      </div>

      {/* 교재 목록 */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">
            교재 목록
            <span className="ml-2 text-xs text-zinc-400 font-normal">{textbooks.length}개</span>
          </span>

          {selectedIds.length > 0 && (
            <button
              onClick={handleDelete}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
            >
              선택 삭제 ({selectedIds.length}개)
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">불러오는 중...</div>
        ) : textbooks.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">등록된 교재가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-2.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-zinc-800"
                  />
                </th>
                {['ID', '교재명', '학년', '단원명', '원본 파일', '문장 수', '등록일'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {textbooks.map((tb) => (
                <tr
                  key={tb.id}
                  onClick={() => toggleSelect(tb.id)}
                  className={`border-b border-zinc-50 transition-colors cursor-pointer select-none ${
                    selectedIds.includes(tb.id) ? 'bg-red-50/50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(tb.id)}
                      onChange={() => toggleSelect(tb.id)}
                      className="w-3.5 h-3.5 accent-zinc-800 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{tb.id}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{tb.title}</td>
                  <td className="px-4 py-3 text-zinc-600">{tb.grade}</td>
                  <td className="px-4 py-3 text-zinc-600">{tb.unit_name}</td>
                  <td className="px-4 py-3 text-zinc-500 truncate max-w-48 text-xs">{tb.original_file_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-zinc-100 text-zinc-700 text-xs font-medium px-2 py-0.5 rounded">
                      {tb._count?.sentences ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {new Date(tb.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
