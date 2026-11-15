import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MathText, splitMath } from '../MathText';

describe('splitMath', () => {
  it('splits inline and display math from text', () => {
    expect(splitMath('If $x+1=2$, then $$x=1$$.')).toEqual([
      { kind: 'text', value: 'If ' },
      { kind: 'inline', value: 'x+1=2' },
      { kind: 'text', value: ', then ' },
      { kind: 'display', value: 'x=1' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('keeps an escaped dollar and an unclosed one as text', () => {
    expect(splitMath('costs \\$5')).toEqual([{ kind: 'text', value: 'costs $5' }]);
    expect(splitMath('a $ b')).toEqual([{ kind: 'text', value: 'a $ b' }]);
  });

  it('does not end a formula at an escaped dollar inside it', () => {
    expect(splitMath('$a\\$b$')).toEqual([{ kind: 'inline', value: 'a\\$b' }]);
  });
});

describe('MathText', () => {
  it('typesets math with KaTeX', () => {
    const { container } = render(<MathText text="What is $\\dfrac{1}{2}$?" />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('What is');
  });

  it('leaves Kangaroo text alone, where a dollar sign means dollars', () => {
    const { container } = render(<MathText text="It costs $3 and $4." math={false} />);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.textContent).toBe('It costs $3 and $4.');
  });
});
