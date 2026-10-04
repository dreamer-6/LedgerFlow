import React from 'react';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '', wrapperClassName = '', ...props }) => {
  return (
    <div className={`lf-table-wrapper ${wrapperClassName}`}>
      <table className={`lf-table ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({ children, selected, className = '', ...props }) => {
  return (
    <tr className={`${selected ? 'selected' : ''} ${className}`} {...props}>
      {children}
    </tr>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  align = 'left',
  numeric = false,
  className = '',
  ...props
}) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  const numClass = numeric ? 'text-mono' : '';

  if (isHeader) {
    return (
      <th className={`${alignClass} ${numClass} ${className}`} {...(props as React.ThHTMLAttributes<HTMLTableHeaderCellElement>)}>
        {children}
      </th>
    );
  }

  return (
    <td className={`${alignClass} ${numClass} ${className}`} {...props}>
      {children}
    </td>
  );
};

export const NumericCell: React.FC<Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'align'>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <TableCell align="right" numeric={true} className={className} {...props}>
      {children}
    </TableCell>
  );
};

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = ''
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={`lf-pagination ${className}`}>
      <span>
        Showing {startItem} to {endItem} of {totalItems} entries
      </span>

      <div className="lf-pagination-pages">
        <button
          type="button"
          className="lf-page-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>

        {getPages().map((page, idx) =>
          typeof page === 'number' ? (
            <button
              key={idx}
              type="button"
              className={`lf-page-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ) : (
            <span key={idx} style={{ padding: '0 4px', color: 'var(--color-text-muted)' }}>
              {page}
            </span>
          )
        )}

        <button
          type="button"
          className="lf-page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
};
