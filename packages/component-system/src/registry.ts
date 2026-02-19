import type { ComponentType } from 'react';
import { createComponentRegistry, type ComponentRegistry } from '@platform/component-contract';
import { Button } from './Button';
import { Chart } from './Chart';
import { CurrencyInput } from './CurrencyInput';
import { DatePicker } from './DatePicker';
import { IBANInput } from './IBANInput';
import { Input } from './Input';
import { OTPInput } from './OTPInput';
import { Stepper } from './Stepper';
import { Table } from './Table';
import { defaultCatalog } from './catalog';

export type ComponentImplementation = ComponentType<any>;

const defaultImplementationMap: Record<string, ComponentImplementation> = {
  'action.button': Button,
  'input.text': Input,
  'input.date': DatePicker,
  'input.currency': CurrencyInput,
  'input.otp': OTPInput,
  'input.iban': IBANInput,
  'navigation.stepper': Stepper,
  'display.table': Table,
  'display.chart': Chart,
};

export function createDefaultComponentRegistry(): ComponentRegistry<ComponentImplementation> {
  const registry = createComponentRegistry<ComponentImplementation>();
  for (const contract of defaultCatalog) {
    registry.register(contract, defaultImplementationMap[contract.type]);
  }
  return registry;
}
