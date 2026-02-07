import type { BlockRule, BlockConstraints, SelectedBlock } from '@nova/shared-types';

/**
 * Constraint-based block selection rules — ported from vitamix-gensite.
 * Generalized: rules are loaded from D1 per project, not hardcoded.
 */

/** Default rules used when no project-specific rules exist */
const DEFAULT_RULES: BlockRule[] = [
  {
    id: 'always-hero',
    name: 'Always Include Hero',
    category: 'structure',
    triggers: [{ type: 'intent', value: '*' }],
    requires: ['hero'],
    excludes: [],
    enhances: [],
    sequenceHints: [{ block: 'hero', position: 'early' }],
    priority: 100,
  },
  {
    id: 'comparison',
    name: 'Comparison Layout',
    category: 'structure',
    triggers: [
      { type: 'keyword', value: '\\bvs\\b' },
      { type: 'intent', value: 'comparison' },
    ],
    requires: ['table'],
    excludes: [],
    enhances: ['cards'],
    sequenceHints: [{ block: 'table', position: 'middle', after: 'hero' }],
    priority: 80,
  },
  {
    id: 'support-faq',
    name: 'Support FAQ',
    category: 'context',
    triggers: [{ type: 'intent', value: 'support' }],
    requires: ['accordion'],
    excludes: [],
    enhances: [],
    sequenceHints: [{ block: 'accordion', position: 'middle' }],
    priority: 70,
  },
  {
    id: 'always-cta',
    name: 'Always End with CTA',
    category: 'conversion',
    triggers: [{ type: 'intent', value: '*' }],
    requires: ['cta'],
    excludes: [],
    enhances: [],
    sequenceHints: [{ block: 'cta', position: 'late' }],
    priority: 90,
  },
];

/**
 * Apply block rules to enforce constraints on selected blocks.
 * Adds required blocks, removes excluded blocks, orders by sequence hints.
 */
export function applyBlockRules(
  selectedBlocks: SelectedBlock[],
  intentType: string,
  query: string,
  rules: BlockRule[] = DEFAULT_RULES,
  constraints?: BlockConstraints,
): SelectedBlock[] {
  const activeRules = rules.filter((rule) =>
    rule.triggers.some((trigger) => {
      if (trigger.type === 'intent') {
        return trigger.value === '*' || trigger.value === intentType;
      }
      if (trigger.type === 'keyword') {
        return new RegExp(trigger.value, 'i').test(query);
      }
      return false;
    }),
  );

  // Sort by priority (highest first)
  activeRules.sort((a, b) => b.priority - a.priority);

  let blocks = [...selectedBlocks];

  // Apply required blocks
  for (const rule of activeRules) {
    for (const required of rule.requires) {
      if (!blocks.some((b) => b.type === required)) {
        blocks.push({ type: required, reason: `Required by rule: ${rule.name}`, priority: 5 });
      }
    }
  }

  // Apply excluded blocks
  const excluded = new Set(activeRules.flatMap((r) => r.excludes));
  blocks = blocks.filter((b) => !excluded.has(b.type));

  // Apply constraints
  if (constraints?.required) {
    for (const req of constraints.required) {
      if (!blocks.some((b) => b.type === req)) {
        blocks.push({ type: req, reason: 'Required by constraints', priority: 5 });
      }
    }
  }
  if (constraints?.excluded) {
    const constraintExcluded = new Set(constraints.excluded);
    blocks = blocks.filter((b) => !constraintExcluded.has(b.type));
  }
  if (constraints?.maxBlocks) {
    blocks = blocks.slice(0, constraints.maxBlocks);
  }

  // Sort by sequence hints
  const positionOrder: Record<string, number> = { early: 0, middle: 1, late: 2 };
  const hintMap = new Map<string, number>();
  for (const rule of activeRules) {
    for (const hint of rule.sequenceHints) {
      hintMap.set(hint.block, positionOrder[hint.position] ?? 1);
    }
  }

  blocks.sort((a, b) => {
    const aOrder = hintMap.get(a.type) ?? 1;
    const bOrder = hintMap.get(b.type) ?? 1;
    return aOrder - bOrder;
  });

  return blocks;
}
