export interface ParseErrorLocation {
  line: number
  column: number
  message: string
}

export interface JsonValidationResult {
  isValid: boolean
  error?: ParseErrorLocation
  parsed?: any
}

export interface TreeNode {
  id: string
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'
  path: string
  depth: number
  children?: TreeNode[]
  childCount?: number
}

export interface SecretFinding {
  path: string
  key: string
  valueSample: string
  type: string
  severity: 'high' | 'medium' | 'low'
}

export interface JsonMetrics {
  totalKeys: number
  maxDepth: number
  sizeBytes: number
  nodeCount: number
  typeCounts: Record<string, number>
  duplicateKeys: string[]
}

/**
 * Validates JSON string and calculates error line & column
 */
export function validateJson(raw: string): JsonValidationResult {
  if (!raw || !raw.trim()) {
    return { isValid: false, error: { line: 1, column: 1, message: 'Input is empty' } }
  }

  try {
    const parsed = JSON.parse(raw)
    return { isValid: true, parsed }
  } catch (err: any) {
    const message = err.message || 'Invalid JSON'
    let line = 1
    let column = 1

    // Extract line/position from standard v8 error message like "at position 45" or "line 2 column 5"
    const posMatch = message.match(/position (\d+)/i) || message.match(/at (\d+)/i)
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10)
      const lines = raw.substring(0, pos).split('\n')
      line = lines.length
      column = lines[lines.length - 1].length + 1
    } else {
      const lineColMatch = message.match(/line (\d+) column (\d+)/i)
      if (lineColMatch) {
        line = parseInt(lineColMatch[1], 10)
        column = parseInt(lineColMatch[2], 10)
      } else {
        // Fallback for "Unexpected end of JSON input"
        const lines = raw.split('\n')
        line = lines.length
        column = lines[lines.length - 1].length + 1
      }
    }

    return { isValid: false, error: { line, column, message } }
  }
}

/**
 * Auto-repairs common JSON syntax flaws:
 * - Trailing commas in arrays and objects
 * - JS line (//) and block (/* *\/) comments
 * - Unquoted keys
 * - Single quote strings
 * - Unterminated strings (e.g. truncated "apiEndpoint":"https:)
 * - Unclosed array [ ] and object { } brackets
 */
export function autoRepairJson(raw: string): string {
  if (!raw.trim()) return raw

  let clean = raw.trim()

  // 1. Remove JS block comments /* ... */
  clean = clean.replace(/\/\*[\s\S]*?\*\//g, '')

  // 2. Remove JS line comments // ...
  clean = clean.replace(/(\s*)\/\/.*$/gm, '')

  // 3. Replace single quotes around strings with double quotes
  clean = clean.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')

  // 4. Quote unquoted object keys: { foo: "bar" } -> { "foo": "bar" }
  clean = clean.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')

  // 5. Remove trailing commas in arrays [1, 2,] -> [1, 2] and objects {"a":1,} -> {"a":1}
  clean = clean.replace(/,(\s*[}\]])/g, '$1')

  // 6. Handle unterminated string & unclosed brackets/braces stack
  let inString = false
  let isEscaped = false
  const stack: ('{' | '[')[] = []

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (inString) {
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
    } else {
      if (char === '"') {
        inString = true
      } else if (char === '{') {
        stack.push('{')
      } else if (char === '[') {
        stack.push('[')
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop()
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop()
        }
      }
    }
  }

  // If string was unterminated at EOF, close string quote
  if (inString) {
    clean += '"'
  }

  // Remove trailing colon or comma e.g. {"a": 1,} or {"a": 1:
  clean = clean.replace(/[,:]\s*$/, '')

  // Close any unclosed brackets/braces in reverse stack order
  while (stack.length > 0) {
    const last = stack.pop()
    if (last === '{') clean += '}'
    else if (last === '[') clean += ']'
  }

  // Final trailing comma cleanup
  clean = clean.replace(/,(\s*[}\]])/g, '$1')

  return clean
}

/**
 * Transforms JS object into tree hierarchy for collapsible viewer
 */
export function buildTree(value: any, key: string = 'root', path: string = '$', depth: number = 0): TreeNode {
  const type = getType(value)

  if (type === 'object' && value !== null) {
    const keys = Object.keys(value)
    const children: TreeNode[] = keys.map((k) => {
      const childPath = path === '$' ? `$.${k}` : `${path}.${k}`
      return buildTree(value[k], k, childPath, depth + 1)
    })

    return {
      id: path,
      key,
      value,
      type: 'object',
      path,
      depth,
      children,
      childCount: keys.length,
    }
  }

  if (type === 'array') {
    const children: TreeNode[] = value.map((item: any, idx: number) => {
      const childPath = `${path}[${idx}]`
      return buildTree(item, `[${idx}]`, childPath, depth + 1)
    })

    return {
      id: path,
      key,
      value,
      type: 'array',
      path,
      depth,
      children,
      childCount: value.length,
    }
  }

  return {
    id: path,
    key,
    value,
    type,
    path,
    depth,
  }
}

function getType(val: any): TreeNode['type'] {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val as any
}

/**
 * Calculates structural metrics for diagnostic tab
 */
export function analyzeMetrics(data: any, rawString: string): JsonMetrics {
  let totalKeys = 0
  let maxDepth = 0
  let nodeCount = 0
  const typeCounts: Record<string, number> = {
    object: 0,
    array: 0,
    string: 0,
    number: 0,
    boolean: 0,
    null: 0,
  }

  const seenKeys = new Set<string>()
  const duplicateKeys: string[] = []

  function traverse(obj: any, currentDepth: number) {
    nodeCount++
    if (currentDepth > maxDepth) maxDepth = currentDepth

    const type = getType(obj)
    typeCounts[type] = (typeCounts[type] || 0) + 1

    if (type === 'object' && obj !== null) {
      for (const k of Object.keys(obj)) {
        totalKeys++
        if (seenKeys.has(k)) {
          if (!duplicateKeys.includes(k)) duplicateKeys.push(k)
        } else {
          seenKeys.add(k)
        }
        traverse(obj[k], currentDepth + 1)
      }
    } else if (type === 'array') {
      for (const item of obj) {
        traverse(item, currentDepth + 1)
      }
    }
  }

  traverse(data, 0)

  return {
    totalKeys,
    maxDepth,
    sizeBytes: new Blob([rawString]).size,
    nodeCount,
    typeCounts,
    duplicateKeys,
  }
}

/**
 * Scans JSON values for leaked secrets, API keys, tokens
 */
export function detectSecrets(data: any): SecretFinding[] {
  const findings: SecretFinding[] = []

  const SENSITIVE_KEY_REGEX = /(password|pass|secret|api_?key|auth|bearer|token|private_?key|credential|jwt)/i

  function traverse(obj: any, path: string, keyName: string) {
    if (typeof obj === 'string') {
      // 1. Check AWS Access Key
      if (/AKIA[0-9A-Z]{16}/.test(obj)) {
        findings.push({
          path,
          key: keyName,
          valueSample: obj.substring(0, 10) + '...',
          type: 'AWS Access Key ID',
          severity: 'high',
        })
      }
      // 2. Check Private Key PEM
      else if (obj.includes('-----BEGIN') && obj.includes('PRIVATE KEY')) {
        findings.push({
          path,
          key: keyName,
          valueSample: '-----BEGIN PRIVATE KEY...',
          type: 'RSA/EC Private Key PEM',
          severity: 'high',
        })
      }
      // 3. Check JWT token format
      else if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(obj)) {
        findings.push({
          path,
          key: keyName,
          valueSample: obj.substring(0, 16) + '...',
          type: 'JSON Web Token (JWT)',
          severity: 'high',
        })
      }
      // 4. Sensitive key name check
      else if (SENSITIVE_KEY_REGEX.test(keyName) && obj.length > 0) {
        findings.push({
          path,
          key: keyName,
          valueSample: obj.length > 8 ? obj.substring(0, 4) + '****' : '****',
          type: `Sensitive Key Name: "${keyName}"`,
          severity: 'medium',
        })
      }
    } else if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => traverse(item, `${path}[${idx}]`, `[${idx}]`))
      } else {
        Object.keys(obj).forEach((k) => traverse(obj[k], path === '$' ? `$.${k}` : `${path}.${k}`, k))
      }
    }
  }

  traverse(data, '$', 'root')
  return findings
}

/**
 * Infers JSON Schema (Draft-07 standard) from JS data
 */
export function generateJsonSchema(data: any): any {
  function infer(val: any): any {
    const type = getType(val)
    if (type === 'null') return { type: 'null' }
    if (type === 'string') return { type: 'string' }
    if (type === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' }
    if (type === 'boolean') return { type: 'boolean' }

    if (type === 'array') {
      if (val.length === 0) return { type: 'array', items: {} }
      const itemSchemas = val.map(infer)
      return { type: 'array', items: itemSchemas[0] }
    }

    if (type === 'object') {
      const properties: Record<string, any> = {}
      const required: string[] = []
      for (const k of Object.keys(val)) {
        properties[k] = infer(val[k])
        required.push(k)
      }
      return {
        type: 'object',
        properties,
        required,
      }
    }

    return {}
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Generated JSON Schema',
    ...infer(data),
  }
}

/**
 * Simple JSONPath query evaluation (support for $.foo.bar, $.items[*], $.items[0])
 */
export function queryJsonPath(data: any, pathQuery: string): any {
  if (!pathQuery || pathQuery === '$') return data

  let query = pathQuery.trim()
  if (query.startsWith('$')) query = query.substring(1)
  if (query.startsWith('.')) query = query.substring(1)

  const parts = query.split('.').filter(Boolean)
  let current = data

  for (const part of parts) {
    if (current === undefined || current === null) return undefined

    // Array index check e.g. "users[0]" or "[0]"
    const arrayMatch = part.match(/^([^\[]*)(?:\[(\d+|\*)\])$/)
    if (arrayMatch) {
      const key = arrayMatch[1]
      const indexStr = arrayMatch[2]

      if (key) {
        current = current[key]
      }

      if (!Array.isArray(current)) return undefined

      if (indexStr === '*') {
        // Return array of all items at property
        return current
      } else {
        const idx = parseInt(indexStr, 10)
        current = current[idx]
      }
    } else {
      current = current[part]
    }
  }

  return current
}

export interface GraphNode {
  id: string
  label: string
  type: string
  path: string
}

export interface GraphEdge {
  source: string
  target: string
  label?: string
}

/**
 * Converts JSON into node & edge graph structure for Visual Graph Viewer
 */
export function buildGraphData(data: any, maxNodes: number = 50): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  let nodeCounter = 0

  function traverse(val: any, label: string, path: string, parentId?: string) {
    if (nodeCounter >= maxNodes) return

    const type = getType(val)
    const id = path || 'root'

    let nodeLabel = label
    if (type === 'string' || type === 'number' || type === 'boolean') {
      nodeLabel = `${label}: ${String(val).substring(0, 15)}`
    } else if (type === 'array') {
      nodeLabel = `${label} [${val.length}]`
    } else if (type === 'object' && val !== null) {
      nodeLabel = `${label} {${Object.keys(val).length}}`
    }

    nodes.push({ id, label: nodeLabel, type, path })
    nodeCounter++

    if (parentId) {
      edges.push({ source: parentId, target: id, label })
    }

    if (type === 'object' && val !== null) {
      for (const k of Object.keys(val)) {
        if (nodeCounter >= maxNodes) break
        traverse(val[k], k, path === '$' ? `$.${k}` : `${path}.${k}`, id)
      }
    } else if (type === 'array') {
      val.forEach((item: any, idx: number) => {
        if (nodeCounter < maxNodes) {
          traverse(item, `[${idx}]`, `${path}[${idx}]`, id)
        }
      })
    }
  }

  traverse(data, 'root', '$')
  return { nodes, edges }
}

export interface TreeSearchOptions {
  query: string
  isRegex: boolean
  isCaseSensitive: boolean
}

export interface TreeSearchResult {
  regex?: RegExp
  error?: string
  totalMatches: number
  matchingNodeIds: Set<string>
  ancestorNodeIds: Set<string>
  descendantNodeIds: Set<string>
}

/**
 * Returns a map of node IDs to expand up to a specific depth level.
 * depthLimit = -1 expands all levels.
 */
export function getExpandedNodeIdsByDepth(root: TreeNode | null, depthLimit: number = -1): Record<string, boolean> {
  const expanded: Record<string, boolean> = {}
  if (!root) return expanded

  function traverse(node: TreeNode) {
    if (node.type === 'object' || node.type === 'array') {
      if (depthLimit === -1 || node.depth < depthLimit) {
        expanded[node.id] = true
      }
      if (node.children) {
        node.children.forEach(traverse)
      }
    }
  }

  traverse(root)
  return expanded
}

/**
 * Compiles a safe regex from query string with support for literal or regex syntax
 */
export function compileSearchRegex(
  query: string,
  isRegex: boolean,
  isCaseSensitive: boolean
): { regex?: RegExp; error?: string } {
  if (!query.trim()) return {}
  try {
    const flags = isCaseSensitive ? '' : 'i'
    if (isRegex) {
      return { regex: new RegExp(query, flags) }
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return { regex: new RegExp(escaped, flags) }
    }
  } catch (err: any) {
    return { error: err.message || 'Invalid regular expression' }
  }
}

/**
 * Recursively tests tree nodes against the search regex, collecting match IDs, ancestor IDs, and descendant IDs
 */
export function searchTreeNodes(root: TreeNode | null, options: TreeSearchOptions): TreeSearchResult {
  if (!root || !options.query.trim()) {
    return {
      totalMatches: 0,
      matchingNodeIds: new Set(),
      ancestorNodeIds: new Set(),
      descendantNodeIds: new Set(),
    }
  }

  const { regex, error } = compileSearchRegex(options.query, options.isRegex, options.isCaseSensitive)
  if (error || !regex) {
    return {
      error,
      totalMatches: 0,
      matchingNodeIds: new Set(),
      ancestorNodeIds: new Set(),
      descendantNodeIds: new Set(),
    }
  }

  const matchingNodeIds = new Set<string>()
  const ancestorNodeIds = new Set<string>()
  const descendantNodeIds = new Set<string>()
  let totalMatches = 0

  function collectDescendants(node: TreeNode) {
    if (node.children) {
      for (const child of node.children) {
        descendantNodeIds.add(child.id)
        collectDescendants(child)
      }
    }
  }

  function checkMatch(node: TreeNode, pathStack: string[]): boolean {
    let selfMatches = false

    // 1. Check key name
    if (node.key && regex!.test(node.key)) {
      selfMatches = true
    }

    // 2. Check leaf value
    if (!selfMatches && node.type !== 'object' && node.type !== 'array' && node.value !== undefined) {
      if (regex!.test(String(node.value))) {
        selfMatches = true
      }
    }

    // 3. Check full path (e.g. $.users[0].name)
    if (!selfMatches && node.path && regex!.test(node.path)) {
      selfMatches = true
    }

    let childrenMatched = false
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childMatched = checkMatch(child, [...pathStack, node.id])
        if (childMatched) {
          childrenMatched = true
        }
      }
    }

    if (selfMatches) {
      matchingNodeIds.add(node.id)
      totalMatches++
      // Auto-expand all ancestors
      for (const ancestor of pathStack) {
        ancestorNodeIds.add(ancestor)
      }
      // If a container matched, expand it and preserve its children
      if (node.type === 'object' || node.type === 'array') {
        ancestorNodeIds.add(node.id)
        collectDescendants(node)
      }
    }

    return selfMatches || childrenMatched
  }

  checkMatch(root, [])
  return { regex, totalMatches, matchingNodeIds, ancestorNodeIds, descendantNodeIds }
}
