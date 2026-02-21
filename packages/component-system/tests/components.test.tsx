import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Button, CurrencyInput, Input, OTPInput } from '../src';

describe('component-system UI primitives', () => {
  it('invokes Button onClick handler', () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<Button onClick={handleClick}>Save</Button>);

    fireEvent.click(getByRole('button', { name: 'Save' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('invokes Input onChange handler', () => {
    const handleChange = vi.fn();
    const { getByLabelText } = render(
      <Input label="Customer Name" value="" onChange={handleChange} />,
    );

    fireEvent.change(getByLabelText('Customer Name'), {
      target: { value: 'Ada' },
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('formats CurrencyInput and emits parsed values', () => {
    const handleValueChange = vi.fn();
    const { getByLabelText } = render(
      <CurrencyInput
        label="Amount"
        value={1234.5}
        locale="en-US"
        currency="USD"
        onValueChange={handleValueChange}
      />,
    );

    const input = getByLabelText('Amount') as HTMLInputElement;
    expect(input.value).toMatch(/\$/);

    fireEvent.focus(input);
    expect(input.value).toBe('1234.5');

    fireEvent.change(input, { target: { value: '5678.9' } });
    fireEvent.blur(input);
    expect(handleValueChange).toHaveBeenCalled();
  });

  it('auto-advances OTPInput and calls onComplete', () => {
    const handleComplete = vi.fn();
    const { getAllByRole } = render(<OTPInput length={4} onComplete={handleComplete} />);

    const inputs = getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });

    expect(handleComplete).toHaveBeenCalledWith('1234');
  });
});
