import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type PropsWithChildren,
  type ReactElement,
} from 'react';

export type ECRConfig = {
  tenantId?: string;
  locale?: string;
  environment?: string;
  [key: string]: unknown;
};

export type ECRProviderProps = PropsWithChildren<{
  config?: ECRConfig;
}>;

const ECRContext = createContext<ECRConfig>({});

export function ECRProvider({ children, config = {} }: ECRProviderProps): ReactElement {
  const value = useMemo(() => config, [config]);
  return createElement(ECRContext.Provider, { value }, children);
}

export function useECR(): ECRConfig {
  return useContext(ECRContext);
}
