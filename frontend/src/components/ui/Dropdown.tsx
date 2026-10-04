import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'left',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ display: 'inline-block' }}>
      <div onClick={() => setIsOpen((prev) => !prev)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className="lf-dropdown"
          style={{
            top: 'calc(100% + 4px)',
            [align === 'right' ? 'right' : 'left']: 0
          }}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="lf-dropdown-divider" />;
            }

            return (
              <div
                key={item.id || idx}
                className={`lf-dropdown-item ${item.danger ? 'danger' : ''}`}
                style={{ opacity: item.disabled ? 0.5 : 1, pointerEvents: item.disabled ? 'none' : 'auto' }}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setIsOpen(false);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
