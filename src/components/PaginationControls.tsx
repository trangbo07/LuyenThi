import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

export default function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50]
}: PaginationControlsProps) {
  const { t } = useI18n();
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  useEffect(() => {
    if (safePage !== page) onPageChange(safePage);
  }, [safePage, page, onPageChange]);

  return (
    <div className="pagination-controls">
      <div className="pagination-meta text-sm">
        {t('pgShowing', { start, end, total: totalItems })}
      </div>

      <div className="pagination-actions">
        <label className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
          {t('pgPerPage')}
        </label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={{ width: 'auto', minWidth: '86px', padding: '0.45rem 0.6rem' }}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.8rem' }}
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          {t('pgPrev')}
        </button>

        <span className="text-sm" style={{ minWidth: '88px', textAlign: 'center', fontWeight: 800 }}>
          {safePage}/{totalPages}
        </span>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.8rem' }}
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          {t('pgNext')}
        </button>
      </div>
    </div>
  );
}
