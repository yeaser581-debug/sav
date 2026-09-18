'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Which rows are ticked. Selection survives paging and filtering — the ids are
 * kept, not the rows — and `visible` is what the header checkbox acts on.
 */
export function useRowSelection(visible: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      const everyone = visible.every(id => next.has(id));
      visible.forEach(id => (everyone ? next.delete(id) : next.add(id)));
      return next;
    });
  }, [visible]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const forget = useCallback((ids: number[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const { allVisible, someVisible } = useMemo(() => {
    const ticked = visible.filter(id => selected.has(id)).length;
    return { allVisible: visible.length > 0 && ticked === visible.length, someVisible: ticked > 0 && ticked < visible.length };
  }, [visible, selected]);

  return {
    selected,
    ids: useMemo(() => [...selected], [selected]),
    count: selected.size,
    isSelected: useCallback((id: number) => selected.has(id), [selected]),
    toggle,
    toggleAllVisible,
    clear,
    forget,
    allVisible,
    someVisible,
  };
}
