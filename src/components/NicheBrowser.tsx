import React, { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { NICHE_CATEGORIES } from '../constants';

interface NicheBrowserProps {
  onSelect: (niche: string) => void;
  selectedNiche: string;
  onClose: () => void;
}

const NicheBrowser: React.FC<NicheBrowserProps> = ({ onSelect, selectedNiche, onClose }) => {
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return NICHE_CATEGORIES;
    const q = search.toLowerCase();
    return NICHE_CATEGORIES
      .map(cat => ({
        ...cat,
        niches: cat.niches.filter(n => n.toLowerCase().includes(q)),
      }))
      .filter(cat => cat.niches.length > 0 || cat.label.toLowerCase().includes(q));
  }, [search]);

  // Auto-expand when searching
  const isSearching = search.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-foreground">Business Category Browser</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search any business type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 text-sm bg-secondary/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-sm font-bold text-muted-foreground">No categories found</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
          </div>
        ) : (
          filtered.map(cat => {
            const isExpanded = isSearching || expandedCategory === cat.label;
            const hasSelected = cat.niches.includes(selectedNiche);

            return (
              <div key={cat.label} className="border-b border-border/50 last:border-0">
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategory(isExpanded && !isSearching ? null : cat.label)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/40 transition-colors ${hasSelected ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{cat.emoji}</span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${hasSelected ? 'text-primary' : 'text-foreground'}`}>
                      {cat.label}
                    </span>
                    {hasSelected && (
                      <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-medium">{cat.niches.length}</span>
                    {!isSearching && (
                      isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Niches Grid */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-1.5">
                    {cat.niches.map(niche => (
                      <button
                        key={niche}
                        onClick={() => {
                          onSelect(niche);
                          onClose();
                        }}
                        className={`text-left text-[11px] font-semibold px-3 py-2 rounded-md transition-all truncate ${
                          selectedNiche === niche
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                            : 'bg-secondary/50 text-foreground hover:bg-primary/10 hover:text-primary'
                        }`}
                        title={niche}
                      >
                        {niche}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2.5 border-t border-border bg-secondary/20 shrink-0">
        <p className="text-[10px] text-muted-foreground font-medium text-center">
          {NICHE_CATEGORIES.reduce((acc, c) => acc + c.niches.length, 0)} business types across {NICHE_CATEGORIES.length} categories
        </p>
      </div>
    </div>
  );
};

export default NicheBrowser;
