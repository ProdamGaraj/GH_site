/**
 * Type-level regression test for BlockNode canonical shape.
 *
 * Ensures the backend type stays structurally compatible with what
 * the frontend serialises into the database. If this file stops
 * compiling (tsc --noEmit), the types have diverged.
 *
 * There are no runtime assertions — the test file itself IS the test.
 * Jest runs it and it passes if and only if TypeScript compiles it.
 */

import type { BlockNode, CSSProperties, Animation, BlockNodeVariation } from '../types/blockNode'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Asserts T is assignable to U at compile time (no runtime cost). */
function assertAssignable<T extends U, U>(_value: T): void { /* no-op */ }

// ── Minimal valid BlockNode (all required fields) ─────────────────────────────

const minimal: BlockNode = {
  id: 'node-1',
  elementType: 'container',
  tagName: 'div',
  styles: { properties: {} },
  children: [],
  attributes: {},
  metadata: {},
}

// ── Full BlockNode (all optional fields populated) ────────────────────────────

const cssProps: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#fff',
  color: '#000',
  padding: '16px',
  customProp: 'value',  // index signature allows arbitrary keys
}

const animation: Animation = {
  id: 'anim-1',
  name: 'Fade in',
  trigger: 'load',
  preset: 'fade-in',
  duration: 400,
  delay: 0,
  easing: 'ease-out',
  iterationCount: 1,
  direction: 'normal',
  fillMode: 'forwards',
  keyframes: [
    { offset: 0, properties: { opacity: '0' } },
    { offset: 100, properties: { opacity: '1' } },
  ],
  scrollTrigger: { threshold: 0.5, once: true, offset: 0 },
}

const variation: BlockNodeVariation = {
  inheritedOverrides: {
    'child-1': { hidden: true, styles: { opacity: '0' } },
  },
  specificChildren: [],
}

const full: BlockNode = {
  id: 'node-2',
  elementType: 'text',
  tagName: 'p',
  tag: 'p',  // deprecated but still valid
  layoutMode: 'flex',
  blockReference: 'lib-block-id',
  styles: {
    properties: cssProps,
    customCSS: '.cls { color: red; }',
    responsive: { tablet: { fontSize: '14px' } },
    states: {
      hover: { color: 'blue' },
      active: { color: 'red' },
    },
    stateTransition: { duration: 200, easing: 'ease', properties: ['color'] },
  },
  animations: [animation],
  scripts: [{
    id: 's1',
    name: 'click handler',
    code: 'console.log("clicked")',
    trigger: 'click',
    enabled: true,
  }],
  children: [minimal],
  attributes: { 'data-test': 'true' },
  content: 'Hello world',
  metadata: {
    locked: false,
    hidden: false,
    name: 'Paragraph',
    linkedBlockId: undefined,
    customHeadHtml: '<meta name="test" content="1">',
    customBodyEndHtml: '<script>window.__test=1</script>',
    breakpoints: [{ id: 'bp-tablet', name: 'Tablet', width: 768 }],
  },
  variations: { 'bp-tablet': variation },
}

// ── Structural compatibility checks ──────────────────────────────────────────

// A full BlockNode must be assignable to BlockNode (trivially true, but explicit).
assertAssignable<typeof full, BlockNode>(full)

// Children array is always assignable as BlockNode[].
assertAssignable<typeof full['children'], BlockNode[]>(full.children)

// ── Jest boilerplate (test runner needs at least one test) ────────────────────

describe('BlockNode canonical types (compile-time)', () => {
  it('compiles without errors — structural compatibility is verified by tsc', () => {
    expect(minimal.id).toBe('node-1')
    expect(full.elementType).toBe('text')
  })
})
