// src/components/CategoryTabs.tsx

import { motion } from 'framer-motion';
import type { Category } from '../types';
import { CATEGORIES } from '../utils/categories';

interface CategoryTabsProps {
  active: Category;
  onChange: (cat: Category) => void;
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="tab-nav" role="tablist" aria-label="Danh mục giá">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          id={`tab-${cat.key}`}
          role="tab"
          aria-selected={active === cat.key}
          aria-controls={`panel-${cat.key}`}
          className={`tab-btn${active === cat.key ? ' active' : ''}`}
          onClick={() => onChange(cat.key)}
          style={active === cat.key ? { color: cat.color } : {}}
        >
          {active === cat.key && (
            <motion.span
              layoutId="tab-indicator"
              className="absolute inset-0 rounded-[9px]"
              style={{ background: 'var(--bg-elevated)' }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10 text-base leading-none">{cat.icon}</span>
          <span className="relative z-10">{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
