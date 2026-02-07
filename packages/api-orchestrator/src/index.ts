import type {
  ApiMapping,
  ExecutionContext,
  JSONValue,
  MappingSource,
} from '@platform/schema';
import type { ApiTrace } from '@platform/observability';

export interface CallApiInput {
  mapping: ApiMapping;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  fetchFn?: typeof fetch;
}

export interface CallApiResult {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  trace: ApiTrace;
}

export async function callApi(input: CallApiInput): Promise<CallApiResult> {
  const started = Date.now();
  const fetchFn = input.fetchFn ?? fetch;
  const data = deepClone(input.data);
  const context = deepClone(input.context);

  const request = buildRequest(input.mapping, data, context);
  const trace: ApiTrace = {
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    apiId: input.mapping.apiId,
    method: input.mapping.method,
    endpoint: input.mapping.endpoint,
    request,
  };

  try {
    const url = appendQuery(input.mapping.endpoint, request.query);
    const response = await fetchFn(url, {
      method: input.mapping.method,
      headers: {
        'content-type': 'application/json',
        ...(request.headers ?? {}),
      } as Record<string, string>,
      body: request.body && input.mapping.method !== 'GET' ? JSON.stringify(request.body) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    let responseBody: unknown = undefined;
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    trace.response = {
      status: response.status,
      body: responseBody,
    };

    applyResponseMap(input.mapping, responseBody, data, context);
  } catch (error) {
    trace.error = error instanceof Error ? error.message : String(error);
  }

  trace.durationMs = Date.now() - started;

  return { data, context, trace };
}

function buildRequest(
  mapping: ApiMapping,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): {
  body?: Record<string, JSONValue>;
  query?: Record<string, JSONValue>;
  headers?: Record<string, JSONValue>;
} {
  const body = resolveMap(mapping.requestMap.body, data, context);
  const query = resolveMap(mapping.requestMap.query, data, context);
  const headers = resolveMap(mapping.requestMap.headers, data, context);

  return {
    body: Object.keys(body).length ? body : undefined,
    query: Object.keys(query).length ? query : undefined,
    headers: Object.keys(headers).length ? headers : undefined,
  };
}

function resolveMap(
  map: Record<string, MappingSource> | undefined,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): Record<string, JSONValue> {
  if (!map) return {};
  const result: Record<string, JSONValue> = {};
  for (const [key, source] of Object.entries(map)) {
    const resolved = resolveSource(source, data, context);
    if (resolved !== undefined) {
      result[key] = resolved;
    }
  }
  return result;
}

function resolveSource(
  source: MappingSource,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): JSONValue | undefined {
  let value: JSONValue | undefined;
  if (source.from.startsWith('literal:')) {
    value = source.from.slice('literal:'.length);
  } else if (source.from.startsWith('data.')) {
    value = getPath(data, source.from.slice('data.'.length));
  } else if (source.from.startsWith('context.')) {
    value = getPath(context as unknown as Record<string, JSONValue>, source.from.slice('context.'.length));
  } else {
    value = getPath(data, source.from);
  }

  if (value === undefined && source.default !== undefined) {
    value = source.default as JSONValue;
  }

  if (source.transform) {
    value = applyTransform(value, source.transform);
  }

  return value;
}

function applyResponseMap(
  mapping: ApiMapping,
  responseBody: unknown,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): void {
  const responseData = responseBody as Record<string, JSONValue>;
  if (mapping.responseMap.data) {
    for (const [target, path] of Object.entries(mapping.responseMap.data)) {
      const value = resolveResponsePath(responseData, path);
      if (value !== undefined) {
        setPath(data, target, value);
      }
    }
  }
  if (mapping.responseMap.context) {
    for (const [target, path] of Object.entries(mapping.responseMap.context)) {
      const value = resolveResponsePath(responseData, path);
      if (value !== undefined) {
        setPath(context as unknown as Record<string, JSONValue>, target, value);
      }
    }
  }
}

function resolveResponsePath(
  responseData: Record<string, JSONValue>,
  path: string,
): JSONValue | undefined {
  if (path.startsWith('response.')) {
    return getPath(responseData, path.slice('response.'.length));
  }
  return getPath(responseData, path);
}

function appendQuery(endpoint: string, query?: Record<string, JSONValue>): string {
  if (!query || Object.keys(query).length === 0) return endpoint;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${params.toString()}`;
}

function applyTransform(value: JSONValue | undefined, expression: string): JSONValue | undefined {
  if (value === undefined) return value;
  const parsed = parseExpression(expression);
  if (!parsed) {
    throw new Error(`Invalid transform expression: ${expression}`);
  }

  const args = parsed.args.map((arg) => resolveArg(arg, value));

  switch (parsed.fn) {
    case 'upper':
      return String(args[0]).toUpperCase();
    case 'lower':
      return String(args[0]).toLowerCase();
    case 'string':
      return String(args[0]);
    case 'number':
      return Number(args[0]);
    case 'concat':
      return args.map((arg) => String(arg)).join('');
    case 'json':
      return JSON.stringify(args[0]);
    default:
      throw new Error(`Unsupported transform: ${parsed.fn}`);
  }
}

function parseExpression(expression: string): { fn: string; args: string[] } | null {
  const match = expression.trim().match(/^([a-zA-Z][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!match || !match[1]) return null;
  const fn = match[1];
  const args = splitArgs(match[2] ?? '');
  return { fn, args };
}

function splitArgs(value: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if ((char === '"' || char === "'") && (i === 0 || value[i - 1] !== '\\')) {
      if (inQuote === char) {
        inQuote = null;
      } else if (!inQuote) {
        inQuote = char;
      }
      current += char;
      continue;
    }
    if (char === ',' && !inQuote) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) {
    args.push(current.trim());
  }
  return args;
}

function resolveArg(arg: string, value: JSONValue): JSONValue {
  const trimmed = arg.trim();
  if (trimmed === '$') return value;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;
  return trimmed;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function getPath(obj: Record<string, JSONValue>, path: string): JSONValue | undefined {
  if (!path) return obj as unknown as JSONValue;
  const parts = tokenizePath(path);
  let current: JSONValue | undefined = obj;
  for (const part of parts) {
    if (part === undefined) return undefined;
    if (current === null || current === undefined) return undefined;
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[part];
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) return undefined;
      current = (current as Record<string, JSONValue>)[part];
    }
  }
  return current;
}

function setPath(obj: Record<string, JSONValue>, path: string, value: JSONValue): void {
  const parts = tokenizePath(path);
  let current: Record<string, JSONValue> | JSONValue[] = obj;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === undefined) return;
    const isLast = i === parts.length - 1;
    if (isLast) {
      if (typeof part === 'number' && Array.isArray(current)) {
        (current as JSONValue[])[part] = value;
      } else if (typeof part === 'string' && !Array.isArray(current)) {
        (current as Record<string, JSONValue>)[part] = value;
      }
      return;
    }
    const nextPart = parts[i + 1];
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return;
      const arr = current as JSONValue[];
      if (arr[part] === undefined) {
        arr[part] = typeof nextPart === 'number' ? [] : {};
      }
      current = arr[part] as Record<string, JSONValue> | JSONValue[];
    } else {
      if (Array.isArray(current)) return;
      const objRef = current as Record<string, JSONValue>;
      if (objRef[part] === undefined) {
        objRef[part] = typeof nextPart === 'number' ? [] : {};
      }
      current = objRef[part] as Record<string, JSONValue> | JSONValue[];
    }
  }
}

function tokenizePath(path: string): Array<string | number> {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized
    .split('.')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const index = Number(segment);
      return Number.isNaN(index) ? segment : index;
    });
}
