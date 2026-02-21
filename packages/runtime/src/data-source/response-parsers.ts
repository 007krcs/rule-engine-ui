import type { DispatchRequest } from './DataSourceAdapter';

export async function parseResponseByType(response: Response, request: DispatchRequest): Promise<unknown> {
  const responseType = request.responseType ?? inferResponseType(response);
  if (responseType === 'binary') {
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return request.binaryMapper ? request.binaryMapper(bytes) : bytes;
  }
  if (responseType === 'xml') {
    const xml = await response.text();
    return request.xmlMapper ? request.xmlMapper(xml) : defaultXmlMapper(xml);
  }
  if (responseType === 'text') {
    return response.text();
  }
  return response.json();
}

function inferResponseType(response: Response): 'json' | 'text' | 'xml' | 'binary' {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/xml') || contentType.includes('text/xml')) return 'xml';
  if (contentType.includes('application/octet-stream')) return 'binary';
  if (contentType.includes('text/plain')) return 'text';
  return 'json';
}

function defaultXmlMapper(xml: string): unknown {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return { rawXml: xml };
    }
    return xmlNodeToObject(doc.documentElement);
  }
  return { rawXml: xml };
}

function xmlNodeToObject(node: Element): unknown {
  const children = Array.from(node.children);
  if (children.length === 0) {
    return node.textContent ?? '';
  }
  const grouped = new Map<string, unknown[]>();
  for (const child of children) {
    const list = grouped.get(child.tagName) ?? [];
    list.push(xmlNodeToObject(child));
    grouped.set(child.tagName, list);
  }
  const result: Record<string, unknown> = {};
  for (const [tag, values] of grouped.entries()) {
    result[tag] = values.length === 1 ? values[0] : values;
  }
  return result;
}
