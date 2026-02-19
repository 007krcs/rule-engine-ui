import styles from './Stepper.module.css';

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'error';

export interface StepDefinition {
  label: string;
  description?: string;
  status?: StepStatus;
}

export interface StepperProps {
  steps: StepDefinition[];
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
}

export function Stepper({
  steps,
  currentStep = 0,
  orientation = 'horizontal',
  ariaLabel = 'Progress steps',
}: StepperProps) {
  return (
    <ol
      className={[
        styles.stepper,
        orientation === 'vertical' ? styles.vertical : styles.horizontal,
      ]
        .join(' ')
        .trim()}
      aria-label={ariaLabel}
    >
      {steps.map((step, index) => {
        const status = step.status ?? inferStatus(index, currentStep);
        const isLast = index === steps.length - 1;
        return (
          <li
            key={`${step.label}-${index}`}
            className={[styles.step, styles[status]].join(' ').trim()}
            aria-current={status === 'current' ? 'step' : undefined}
          >
            <span className={styles.indicator}>{status === 'complete' ? 'OK' : index + 1}</span>
            <span className={styles.labelGroup}>
              <span className={styles.title}>{step.label}</span>
              {step.description ? <span className={styles.subtitle}>{step.description}</span> : null}
            </span>
            {!isLast ? <span className={styles.connector} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function inferStatus(index: number, currentStep: number): StepStatus {
  if (index < currentStep) return 'complete';
  if (index === currentStep) return 'current';
  return 'upcoming';
}
