import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { buildDecisionTree, walkTree, type DecisionResult, type SimulationResult, type TreeNode } from '../engine';

interface DecisionTreeViewProps {
  result: DecisionResult;
  sim: SimulationResult | null;
}

const STATUS_LABEL: Record<string, string> = {
  winner: 'WINNER',
  rejected: 'REJECTED',
  support: 'supports',
  oppose: 'opposes',
  flip: 'flips',
  stable: 'holds',
  neutral: '',
};

/** Accessible tree (WAI-ARIA tree pattern) over real engine output. */
export function DecisionTreeView({ result, sim }: DecisionTreeViewProps) {
  const tree = useMemo(() => buildDecisionTree(result, sim), [result, sim]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['n-root', `n-${result.winnerId}`]));
  const [selectedId, setSelectedId] = useState<string>('n-root');
  const treeRef = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<string | null>(null);

  const index = useMemo(() => {
    const byId = new Map<string, { node: TreeNode; parent: string | null }>();
    const visit = (node: TreeNode, parent: string | null) => {
      byId.set(node.id, { node, parent });
      node.children.forEach((c) => visit(c, node.id));
    };
    visit(tree, null);
    return byId;
  }, [tree]);

  const totalNodes = useMemo(() => {
    let n = 0;
    walkTree(tree, () => n++);
    return n;
  }, [tree]);

  const selected = index.get(selectedId)?.node ?? tree;

  // Visible nodes in document order, for arrow-key navigation.
  const visible: string[] = [];
  const collect = (node: TreeNode) => {
    visible.push(node.id);
    if (expanded.has(node.id)) node.children.forEach(collect);
  };
  collect(tree);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const focusElement = (id: string) => treeRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();

  // Move DOM focus right after React commits the new selection (roving tabindex).
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      focusElement(pendingFocus.current);
      pendingFocus.current = null;
    }
  });

  const focusNode = (id: string) => {
    if (id === selectedId) {
      focusElement(id);
      return;
    }
    pendingFocus.current = id;
    setSelectedId(id);
  };

  const onKeyDown = (e: KeyboardEvent, node: TreeNode) => {
    const pos = visible.indexOf(node.id);
    const hasKids = node.children.length > 0;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (pos < visible.length - 1) focusNode(visible[pos + 1]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (pos > 0) focusNode(visible[pos - 1]);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (hasKids && !expanded.has(node.id)) toggle(node.id);
        else if (hasKids) focusNode(node.children[0].id);
        break;
      case 'ArrowLeft': {
        e.preventDefault();
        if (hasKids && expanded.has(node.id)) toggle(node.id);
        else {
          const parent = index.get(node.id)?.parent;
          if (parent) focusNode(parent);
        }
        break;
      }
      case 'Home':
        e.preventDefault();
        focusNode(visible[0]);
        break;
      case 'End':
        e.preventDefault();
        focusNode(visible[visible.length - 1]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setSelectedId(node.id);
        if (hasKids) toggle(node.id);
        break;
    }
  };

  const expandAll = () => {
    const all = new Set<string>();
    walkTree(tree, (n) => n.children.length && all.add(n.id));
    setExpanded(all);
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isOpen = expanded.has(node.id);
    const hasKids = node.children.length > 0;
    return (
      <li
        key={node.id}
        role="treeitem"
        aria-expanded={hasKids ? isOpen : undefined}
        aria-selected={selectedId === node.id}
        aria-level={depth + 1}
        className={`tree-item kind-${node.kind}`}
      >
        <div
          className={`tree-row status-${node.status ?? 'neutral'} ${selectedId === node.id ? 'selected' : ''}`}
          data-node-id={node.id}
          tabIndex={selectedId === node.id ? 0 : -1}
          onClick={() => {
            setSelectedId(node.id);
            if (hasKids) toggle(node.id);
          }}
          onKeyDown={(e) => onKeyDown(e, node)}
        >
          <span className="tree-caret" aria-hidden="true">
            {hasKids ? (isOpen ? '▾' : '▸') : '•'}
          </span>
          <span className="tree-label">{node.label}</span>
          {node.badge && <span className="tree-badge">{node.badge}</span>}
          {node.status && STATUS_LABEL[node.status] && <span className={`tree-status s-${node.status}`}>{STATUS_LABEL[node.status]}</span>}
        </div>
        {hasKids && isOpen && (
          <ul role="group" className="tree-group">
            {node.children.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section id="tree" className="panel section" aria-labelledby="tree-title">
      <div className="sticker">EXHIBIT C</div>
      <h2 id="tree-title" className="section-title">The Decision Tree of Infinite Branching</h2>
      <p className="section-sub">
        {totalNodes} nodes, every one computed from the engine: alternatives, all specialist criteria and their factors, leave-one-out
        robustness checks, flip conditions and global “what if” scenarios. Use arrow keys to navigate, Enter to expand.
      </p>
      <div className="tree-toolbar">
        <button className="btn btn-small" onClick={expandAll}>
          Expand all
        </button>
        <button className="btn btn-small" onClick={() => setExpanded(new Set(['n-root']))}>
          Collapse all
        </button>
        {!sim && <span className="hint">Monte Carlo branches appear when the simulation finishes.</span>}
      </div>
      <div className="tree-layout">
        <ul className="tree" role="tree" aria-label="Decision tree" ref={treeRef}>
          {renderNode(tree, 0)}
        </ul>
        <aside className="tree-inspector" aria-live="polite" aria-label="Selected branch details">
          <div className="inspector-kind">{selected.kind.toUpperCase()}</div>
          <h3>{selected.label}</h3>
          {selected.status && STATUS_LABEL[selected.status] && (
            <span className={`tree-status s-${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
          )}
          {selected.detail && <p>{selected.detail}</p>}
          {selected.metrics && (
            <dl className="inspector-metrics">
              {selected.metrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {selected.children.length > 0 && (
            <p className="hint">
              {selected.children.length} child branch{selected.children.length === 1 ? '' : 'es'}.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
