export interface ParseErrorLocation {
  line: number
  column: number
  message: string
}

export interface JsonValidationResult {
  isValid: boolean
  error?: ParseErrorLocation
  parsed?: any
  hadComments?: boolean
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

export interface SchemaGuardOptions {
  strictTypes?: boolean
  disallowExtraProperties?: boolean
  disallowNulls?: boolean
  disallowEmptyStringsOrArrays?: boolean
}

export interface SchemaViolation {
  path: string
  keyword: string
  message: string
  severity: 'error' | 'warning'
  expected?: string
  actual?: string
}

export interface SchemaGuardResult {
  isValid: boolean
  violations: SchemaViolation[]
  summary: {
    totalChecked: number
    errorCount: number
    warningCount: number
  }
}

export interface SchemaDiffItem {
  path: string
  type: 'missing_key' | 'type_mismatch' | 'extra_key' | 'nullability_violation' | 'value_out_of_bounds'
  severity: 'error' | 'warning'
  message: string
  expected?: string
  actual?: string
}

// Visual Graph Flowchart Interfaces
export interface GraphField {
  key: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'
  value?: any
  childNodeId?: string
}

export interface FlowGraphNode {
  id: string
  title: string
  path: string
  type: 'object' | 'array'
  depth: number
  x: number
  y: number
  width: number
  height: number
  fields: GraphField[]
}

export interface FlowGraphEdge {
  id: string
  sourceNodeId: string
  sourceKey: string
  targetNodeId: string
  sourceYOffset: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface FlowGraphData {
  nodes: FlowGraphNode[]
  edges: FlowGraphEdge[]
  canvasWidth: number
  canvasHeight: number
}

// POJO Generator Interfaces
export type PojoLanguage =
  | 'java'
  | 'python'
  | 'typescript'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'kotlin'
  | 'swift'
  | 'dart'
  | 'zod'

export interface PojoGeneratorOptions {
  language: PojoLanguage
  rootClassName?: string
  accessModifier?: 'private' | 'public' | 'protected'
  useGettersSetters?: boolean
  useLombok?: boolean
  useJackson?: boolean
  usePydantic?: boolean
  useDataclasses?: boolean
}

export interface PojoResult {
  code: string
  fileExtension: string
  mimeType: string
}

/**
 * Context-aware stripper that safely removes line comments (//, --, #)
 * and block comments (/* *\/) without corrupting string literals or URLs.
 */
export function stripJsonComments(raw: string): string {
  if (!raw) return raw

  let result = ''
  let inString: string | null = null
  let isEscaped = false
  let i = 0

  while (i < raw.length) {
    const char = raw[i]
    const nextChar = raw[i + 1]

    if (inString) {
      result += char
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === inString) {
        inString = null
      }
      i++
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char
      result += char
      i++
      continue
    }

    // Block comments /* ... */
    if (char === '/' && nextChar === '*') {
      i += 2
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) {
        if (raw[i] === '\n') result += '\n'
        else result += ' '
        i++
      }
      if (i < raw.length) i += 2
      continue
    }

    // Line comments: // or -- or #
    if ((char === '/' && nextChar === '/') || (char === '-' && nextChar === '-') || char === '#') {
      const isTwoChar = char !== '#'
      i += isTwoChar ? 2 : 1
      while (i < raw.length && raw[i] !== '\n') {
        result += ' '
        i++
      }
      continue
    }

    result += char
    i++
  }

  return result
}

/**
 * Validates JSON string and calculates error line & column.
 */
export function validateJson(raw: string): JsonValidationResult {
  if (!raw || !raw.trim()) {
    return { isValid: false, error: { line: 1, column: 1, message: 'Input is empty' } }
  }

  try {
    const parsed = JSON.parse(raw)
    return { isValid: true, parsed, hadComments: false }
  } catch {
    const stripped = stripJsonComments(raw)
    try {
      const parsed = JSON.parse(stripped)
      return { isValid: true, parsed, hadComments: true }
    } catch (err: any) {
      const message = err.message || 'Invalid JSON'
      let line = 1
      let column = 1

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
          const lines = raw.split('\n')
          line = lines.length
          column = lines[lines.length - 1].length + 1
        }
      }

      return { isValid: false, error: { line, column, message } }
    }
  }
}

/**
 * Auto-repairs common JSON syntax flaws
 */
export function autoRepairJson(raw: string): string {
  if (!raw.trim()) return raw

  let clean = stripJsonComments(raw).trim()

  clean = clean.replace(/\bNone\b/g, 'null')
  clean = clean.replace(/\bTrue\b/g, 'true')
  clean = clean.replace(/\bFalse\b/g, 'false')
  clean = clean.replace(/\bundefined\b/g, 'null')
  clean = clean.replace(/\bNaN\b/g, 'null')

  clean = clean.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
  clean = clean.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
  clean = clean.replace(/,(\s*[}\]])/g, '$1')
  clean = clean.replace(/("(?:[^"\\]|\\.)*"\s*:\s*(?:"(?:[^"\\]|\\.)*"|\d+|true|false|null))\s+(?="(?:[^"\\]|\\.)*"\s*:)/g, '$1, ')

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

  if (inString) {
    clean += '"'
  }

  clean = clean.replace(/[,:]\s*$/, '')

  while (stack.length > 0) {
    const last = stack.pop()
    if (last === '{') clean += '}'
    else if (last === '[') clean += ']'
  }

  clean = clean.replace(/,(\s*[}\]])/g, '$1')

  return clean
}

/**
 * Sorts object keys alphabetically (A-Z or Z-A), optionally recursively.
 */
export function sortJsonKeys(data: any, reverse: boolean = false, recursive: boolean = true): any {
  if (data === null || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    if (!recursive) return data
    return data.map((item) => sortJsonKeys(item, reverse, recursive))
  }

  const keys = Object.keys(data)
  keys.sort((a, b) => {
    const cmp = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
    return reverse ? -cmp : cmp
  })

  const sortedObj: Record<string, any> = {}
  for (const key of keys) {
    const val = data[key]
    sortedObj[key] = recursive && typeof val === 'object' && val !== null
      ? sortJsonKeys(val, reverse, recursive)
      : val
  }

  return sortedObj
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
      if (/AKIA[0-9A-Z]{16}/.test(obj)) {
        findings.push({
          path,
          key: keyName,
          valueSample: obj.substring(0, 10) + '...',
          type: 'AWS Access Key ID',
          severity: 'high',
        })
      } else if (obj.includes('-----BEGIN') && obj.includes('PRIVATE KEY')) {
        findings.push({
          path,
          key: keyName,
          valueSample: '-----BEGIN PRIVATE KEY...',
          type: 'RSA/EC Private Key PEM',
          severity: 'high',
        })
      } else if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(obj)) {
        findings.push({
          path,
          key: keyName,
          valueSample: obj.substring(0, 16) + '...',
          type: 'JSON Web Token (JWT)',
          severity: 'high',
        })
      } else if (SENSITIVE_KEY_REGEX.test(keyName) && obj.length > 0) {
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
 * Validates data against a JSON Schema and applies SchemaGuard policy checks.
 */
export function validateAgainstSchema(
  data: any,
  schema: any,
  options: SchemaGuardOptions = {}
): SchemaGuardResult {
  const violations: SchemaViolation[] = []
  let totalChecked = 0

  function check(val: any, s: any, path: string) {
    totalChecked++
    if (!s || typeof s !== 'object') return

    const actualType = getType(val)

    if (s.type) {
      const allowedTypes = Array.isArray(s.type) ? s.type : [s.type]
      let typeMatch = allowedTypes.includes(actualType)
      if (s.type === 'integer' && actualType === 'number' && Number.isInteger(val)) {
        typeMatch = true
      }

      if (!typeMatch) {
        violations.push({
          path,
          keyword: 'type',
          message: `Expected type "${s.type}", but got "${actualType}".`,
          severity: 'error',
          expected: String(s.type),
          actual: actualType,
        })
        return
      }
    }

    if (options.disallowNulls && val === null) {
      violations.push({
        path,
        keyword: 'disallowNulls',
        message: `Null value at "${path}" is prohibited by policy.`,
        severity: 'warning',
        expected: 'non-null',
        actual: 'null',
      })
    }

    if (options.disallowEmptyStringsOrArrays) {
      if (typeof val === 'string' && val.trim() === '') {
        violations.push({
          path,
          keyword: 'disallowEmpty',
          message: `String at "${path}" is empty (prohibited by policy).`,
          severity: 'warning',
          expected: 'non-empty string',
          actual: '""',
        })
      } else if (Array.isArray(val) && val.length === 0) {
        violations.push({
          path,
          keyword: 'disallowEmpty',
          message: `Array at "${path}" is empty (prohibited by policy).`,
          severity: 'warning',
          expected: 'non-empty array',
          actual: '[]',
        })
      }
    }

    if (typeof val === 'string') {
      if (s.minLength !== undefined && val.length < s.minLength) {
        violations.push({
          path,
          keyword: 'minLength',
          message: `String length (${val.length}) is less than minLength (${s.minLength}).`,
          severity: 'error',
          expected: `>= ${s.minLength}`,
          actual: String(val.length),
        })
      }
      if (s.maxLength !== undefined && val.length > s.maxLength) {
        violations.push({
          path,
          keyword: 'maxLength',
          message: `String length (${val.length}) exceeds maxLength (${s.maxLength}).`,
          severity: 'error',
          expected: `<= ${s.maxLength}`,
          actual: String(val.length),
        })
      }
      if (s.pattern) {
        try {
          const reg = new RegExp(s.pattern)
          if (!reg.test(val)) {
            violations.push({
              path,
              keyword: 'pattern',
              message: `String does not match pattern "${s.pattern}".`,
              severity: 'error',
              expected: s.pattern,
              actual: val,
            })
          }
        } catch {
          // ignore invalid regex
        }
      }
    }

    if (typeof val === 'number') {
      if (s.minimum !== undefined && val < s.minimum) {
        violations.push({
          path,
          keyword: 'minimum',
          message: `Value (${val}) is less than minimum (${s.minimum}).`,
          severity: 'error',
          expected: `>= ${s.minimum}`,
          actual: String(val),
        })
      }
      if (s.maximum !== undefined && val > s.maximum) {
        violations.push({
          path,
          keyword: 'maximum',
          message: `Value (${val}) exceeds maximum (${s.maximum}).`,
          severity: 'error',
          expected: `<= ${s.maximum}`,
          actual: String(val),
        })
      }
    }

    if (s.enum && Array.isArray(s.enum)) {
      if (!s.enum.includes(val)) {
        violations.push({
          path,
          keyword: 'enum',
          message: `Value "${val}" is not allowed in enum: [${s.enum.join(', ')}].`,
          severity: 'error',
          expected: s.enum.join(', '),
          actual: String(val),
        })
      }
    }

    if (actualType === 'object' && val !== null) {
      const keys = Object.keys(val)
      const allowedProps = s.properties ? Object.keys(s.properties) : []

      if (Array.isArray(s.required)) {
        for (const reqKey of s.required) {
          if (!(reqKey in val)) {
            violations.push({
              path: path === '$' ? `$.${reqKey}` : `${path}.${reqKey}`,
              keyword: 'required',
              message: `Missing required property "${reqKey}".`,
              severity: 'error',
              expected: 'present property',
              actual: 'missing',
            })
          }
        }
      }

      const disallowExtra = options.disallowExtraProperties || s.additionalProperties === false
      if (disallowExtra) {
        for (const k of keys) {
          if (!allowedProps.includes(k)) {
            violations.push({
              path: path === '$' ? `$.${k}` : `${path}.${k}`,
              keyword: 'additionalProperties',
              message: `Unexpected extra property "${k}".`,
              severity: options.disallowExtraProperties ? 'error' : 'warning',
              expected: 'defined in schema',
              actual: 'unexpected key',
            })
          }
        }
      }

      if (s.properties) {
        for (const k of keys) {
          if (s.properties[k]) {
            check(val[k], s.properties[k], path === '$' ? `$.${k}` : `${path}.${k}`)
          }
        }
      }
    }

    if (actualType === 'array') {
      if (s.minItems !== undefined && val.length < s.minItems) {
        violations.push({
          path,
          keyword: 'minItems',
          message: `Array length (${val.length}) is less than minItems (${s.minItems}).`,
          severity: 'error',
          expected: `>= ${s.minItems}`,
          actual: String(val.length),
        })
      }
      if (s.maxItems !== undefined && val.length > s.maxItems) {
        violations.push({
          path,
          keyword: 'maxItems',
          message: `Array length (${val.length}) exceeds maxItems (${s.maxItems}).`,
          severity: 'error',
          expected: `<= ${s.maxItems}`,
          actual: String(val.length),
        })
      }
      if (s.items) {
        val.forEach((item: any, idx: number) => {
          check(item, s.items, `${path}[${idx}]`)
        })
      }
    }
  }

  check(data, schema, '$')

  const errorCount = violations.filter((v) => v.severity === 'error').length
  const warningCount = violations.filter((v) => v.severity === 'warning').length

  return {
    isValid: errorCount === 0,
    violations,
    summary: { totalChecked, errorCount, warningCount },
  }
}

/**
 * Automatically repairs schema violations
 */
export function fixSchemaViolations(data: any, schema: any, options: SchemaGuardOptions = {}): any {
  if (!schema || typeof schema !== 'object' || data === undefined) return data

  const type = getType(data)

  if (type === 'object' && data !== null) {
    const fixed: Record<string, any> = { ...data }

    if (Array.isArray(schema.required) && schema.properties) {
      for (const reqKey of schema.required) {
        if (!(reqKey in fixed)) {
          fixed[reqKey] = getDefaultForSchema(schema.properties[reqKey])
        }
      }
    }

    if (options.disallowExtraProperties || schema.additionalProperties === false) {
      const allowed = schema.properties ? Object.keys(schema.properties) : []
      for (const key of Object.keys(fixed)) {
        if (!allowed.includes(key)) {
          delete fixed[key]
        }
      }
    }

    if (schema.properties) {
      for (const key of Object.keys(fixed)) {
        if (schema.properties[key]) {
          fixed[key] = fixSchemaViolations(fixed[key], schema.properties[key], options)
        }
      }
    }

    return fixed
  }

  if (type === 'array' && schema.items) {
    let fixedArr = data.map((item: any) => fixSchemaViolations(item, schema.items, options))
    if (options.disallowEmptyStringsOrArrays && fixedArr.length === 0) {
      fixedArr = [getDefaultForSchema(schema.items)]
    }
    return fixedArr
  }

  if (options.disallowNulls && data === null) {
    return getDefaultForSchema(schema)
  }

  if (options.disallowEmptyStringsOrArrays && typeof data === 'string' && data.trim() === '') {
    return 'default_value'
  }

  return data
}

function getDefaultForSchema(s?: any): any {
  if (!s || !s.type) return ''
  switch (s.type) {
    case 'string':
      return s.enum && s.enum.length > 0 ? s.enum[0] : 'sample'
    case 'number':
    case 'integer':
      return s.minimum ?? 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return {}
    default:
      return null
  }
}

/**
 * Detects structural diffs between JSON data and a target Schema.
 */
export function detectSchemaDiff(jsonData: any, targetSchema: any): SchemaDiffItem[] {
  const validation = validateAgainstSchema(jsonData, targetSchema, { disallowExtraProperties: true })
  return validation.violations.map((v) => ({
    path: v.path,
    type:
      v.keyword === 'required'
        ? 'missing_key'
        : v.keyword === 'type'
        ? 'type_mismatch'
        : v.keyword === 'additionalProperties'
        ? 'extra_key'
        : 'value_out_of_bounds',
    severity: v.severity,
    message: v.message,
    expected: v.expected,
    actual: v.actual,
  }))
}

/**
 * Builds structured node-flowchart topology with connecting edges for Visual Graph tab (JSON Crack style).
 */
export function buildHierarchicalGraphData(data: any, maxNodes: number = 40): FlowGraphData {
  const nodes: FlowGraphNode[] = []
  const edges: FlowGraphEdge[] = []

  let nodeCounter = 0
  const NODE_WIDTH = 280
  const ROW_HEIGHT = 28
  const HEADER_HEIGHT = 44
  const COLUMN_GAP = 120
  const ROW_GAP = 30

  // Track height of each column level (depth)
  const levelYOffsets: Record<number, number> = {}

  function processNode(val: any, title: string, path: string, depth: number): string | undefined {
    if (nodeCounter >= maxNodes) return undefined

    const type = getType(val)
    if (type !== 'object' && type !== 'array') return undefined

    const nodeId = path || 'root'
    const fields: GraphField[] = []

    let totalContentHeight = HEADER_HEIGHT

    if (type === 'object' && val !== null) {
      const keys = Object.keys(val)
      totalContentHeight += keys.length * ROW_HEIGHT

      for (const k of keys) {
        const itemVal = val[k]
        const itemType = getType(itemVal)
        const childPath = path === '$' ? `$.${k}` : `${path}.${k}`

        if (itemType === 'object' || itemType === 'array') {
          const childId = childPath
          fields.push({ key: k, type: itemType, childNodeId: childId })
        } else {
          fields.push({ key: k, type: itemType, value: itemVal })
        }
      }
    } else if (type === 'array') {
      totalContentHeight += val.length * ROW_HEIGHT

      val.forEach((itemVal: any, idx: number) => {
        const itemType = getType(itemVal)
        const childPath = `${path}[${idx}]`
        const keyLabel = `[${idx}]`

        if (itemType === 'object' || itemType === 'array') {
          fields.push({ key: keyLabel, type: itemType, childNodeId: childPath })
        } else {
          fields.push({ key: keyLabel, type: itemType, value: itemVal })
        }
      })
    }

    const currentY = levelYOffsets[depth] || 40
    const x = 50 + depth * (NODE_WIDTH + COLUMN_GAP)
    const y = currentY
    const height = Math.max(totalContentHeight, 80)

    levelYOffsets[depth] = y + height + ROW_GAP

    nodes.push({
      id: nodeId,
      title: title || 'ROOT',
      path: path || '$',
      type,
      depth,
      x,
      y,
      width: NODE_WIDTH,
      height,
      fields,
    })
    nodeCounter++

    // Process nested children
    fields.forEach((field, fieldIdx) => {
      if (field.childNodeId) {
        const rawChildVal = type === 'object' ? val[field.key] : val[parseInt(field.key.replace(/\[|\]/g, ''), 10)]
        const createdChildId = processNode(rawChildVal, field.key, field.childNodeId, depth + 1)

        if (createdChildId) {
          const rowYCenter = y + HEADER_HEIGHT + fieldIdx * ROW_HEIGHT + ROW_HEIGHT / 2
          const sourceX = x + NODE_WIDTH
          const sourceY = rowYCenter

          edges.push({
            id: `edge-${nodeId}-${field.key}-${createdChildId}`,
            sourceNodeId: nodeId,
            sourceKey: field.key,
            targetNodeId: createdChildId,
            sourceYOffset: fieldIdx * ROW_HEIGHT,
            sourceX,
            sourceY,
            targetX: 0, // Computed in second pass
            targetY: 0,
          })
        }
      }
    })

    return nodeId
  }

  processNode(data, 'ROOT', '$', 0)

  // Compute exact target coordinates for edges
  const nodeMap = new Map<string, FlowGraphNode>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  let maxCanvasX = 800
  let maxCanvasY = 600

  edges.forEach((edge) => {
    const targetNode = nodeMap.get(edge.targetNodeId)
    if (targetNode) {
      edge.targetX = targetNode.x
      edge.targetY = targetNode.y + HEADER_HEIGHT / 2
    }
  })

  nodes.forEach((n) => {
    if (n.x + n.width + 100 > maxCanvasX) maxCanvasX = n.x + n.width + 100
    if (n.y + n.height + 100 > maxCanvasY) maxCanvasY = n.y + n.height + 100
  })

  return {
    nodes,
    edges,
    canvasWidth: maxCanvasX,
    canvasHeight: maxCanvasY,
  }
}

/**
 * POJO & Class Model Code Generator Engine
 */
export function generatePojoCode(data: any, options: PojoGeneratorOptions): PojoResult {
  const rootName = options.rootClassName?.trim() || 'RootModel'
  const lang = options.language

  // 1. Collect nested class structures
  interface ClassDef {
    className: string
    fields: { key: string; type: string; isNestedClass: boolean; isArray: boolean; isOptional: boolean }[]
  }

  const classesMap = new Map<string, ClassDef>()

  function sanitizeClassName(name: string): string {
    let clean = name.replace(/[^a-zA-Z0-9_$]/g, '')
    if (!clean) clean = 'Model'
    return clean.charAt(0).toUpperCase() + clean.slice(1)
  }

  function sanitizePropName(key: string): string {
    const clean = key.replace(/[^a-zA-Z0-9_$]/g, '_')
    return clean.charAt(0).toLowerCase() + clean.slice(1)
  }

  function inferType(val: any, propKey: string): { typeName: string; isNestedClass: boolean; isArray: boolean } {
    const type = getType(val)
    if (type === 'string') return { typeName: 'string', isNestedClass: false, isArray: false }
    if (type === 'number') return { typeName: Number.isInteger(val) ? 'integer' : 'number', isNestedClass: false, isArray: false }
    if (type === 'boolean') return { typeName: 'boolean', isNestedClass: false, isArray: false }
    if (type === 'null') return { typeName: 'any', isNestedClass: false, isArray: false }

    if (type === 'array') {
      if (val.length === 0) return { typeName: 'any', isNestedClass: false, isArray: true }
      const elemRes = inferType(val[0], propKey)
      return { typeName: elemRes.typeName, isNestedClass: elemRes.isNestedClass, isArray: true }
    }

    if (type === 'object') {
      const clsName = sanitizeClassName(propKey)
      extractClass(val, clsName)
      return { typeName: clsName, isNestedClass: true, isArray: false }
    }

    return { typeName: 'any', isNestedClass: false, isArray: false }
  }

  function extractClass(obj: any, clsName: string) {
    if (classesMap.has(clsName)) return
    const fields: ClassDef['fields'] = []

    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const info = inferType(obj[k], k)
        fields.push({
          key: k,
          type: info.typeName,
          isNestedClass: info.isNestedClass,
          isArray: info.isArray,
          isOptional: false,
        })
      }
    }

    classesMap.set(clsName, { className: clsName, fields })
  }

  extractClass(data, rootName)

  // 2. Render code based on target language
  const access = options.accessModifier || 'private'

  if (lang === 'java') {
    let out = ''
    if (options.useLombok) {
      out += `import lombok.Data;\nimport lombok.NoArgsConstructor;\nimport lombok.AllArgsConstructor;\n`
    }
    if (options.useJackson) {
      out += `import com.fasterxml.jackson.annotation.JsonProperty;\n`
    }
    out += `import java.util.List;\n\n`

    const classBlocks: string[] = []

    for (const [clsName, def] of classesMap.entries()) {
      let block = ''
      if (options.useLombok) {
        block += `@Data\n@NoArgsConstructor\n@AllArgsConstructor\n`
      }
      block += `public class ${clsName} {\n`

      for (const f of def.fields) {
        const propName = sanitizePropName(f.key)
        let javaType = 'Object'

        if (f.type === 'string') javaType = 'String'
        else if (f.type === 'integer') javaType = 'Long'
        else if (f.type === 'number') javaType = 'Double'
        else if (f.type === 'boolean') javaType = 'Boolean'
        else if (f.isNestedClass) javaType = f.type

        if (f.isArray) javaType = `List<${javaType}>`

        if (options.useJackson) {
          block += `    @JsonProperty("${f.key}")\n`
        }

        block += `    ${access} ${javaType} ${propName};\n\n`
      }

      // Add getters & setters if private and not Lombok
      if (access === 'private' && !options.useLombok) {
        for (const f of def.fields) {
          const propName = sanitizePropName(f.key)
          const capName = propName.charAt(0).toUpperCase() + propName.slice(1)
          let javaType = 'Object'
          if (f.type === 'string') javaType = 'String'
          else if (f.type === 'integer') javaType = 'Long'
          else if (f.type === 'number') javaType = 'Double'
          else if (f.type === 'boolean') javaType = 'Boolean'
          else if (f.isNestedClass) javaType = f.type
          if (f.isArray) javaType = `List<${javaType}>`

          block += `    public ${javaType} get${capName}() {\n        return ${propName};\n    }\n\n`
          block += `    public void set${capName}(${javaType} ${propName}) {\n        this.${propName} = ${propName};\n    }\n\n`
        }
      }

      block += `}\n`
      classBlocks.push(block)
    }

    out += classBlocks.reverse().join('\n')
    return { code: out.trim(), fileExtension: 'java', mimeType: 'text/x-java-source' }
  }

  if (lang === 'python') {
    let out = ''
    if (options.usePydantic) {
      out += `from typing import List, Optional, Any\nfrom pydantic import BaseModel, Field\n\n`
      const classBlocks: string[] = []

      for (const [clsName, def] of classesMap.entries()) {
        let block = `class ${clsName}(BaseModel):\n`
        if (def.fields.length === 0) block += `    pass\n`

        for (const f of def.fields) {
          const propName = sanitizePropName(f.key)
          let pyType = 'Any'

          if (f.type === 'string') pyType = 'str'
          else if (f.type === 'integer') pyType = 'int'
          else if (f.type === 'number') pyType = 'float'
          else if (f.type === 'boolean') pyType = 'bool'
          else if (f.isNestedClass) pyType = f.type

          if (f.isArray) pyType = `List[${pyType}]`

          if (propName !== f.key) {
            block += `    ${propName}: ${pyType} = Field(alias="${f.key}")\n`
          } else {
            block += `    ${propName}: ${pyType}\n`
          }
        }
        classBlocks.push(block)
      }
      out += classBlocks.reverse().join('\n')
      return { code: out.trim(), fileExtension: 'py', mimeType: 'text/x-python' }
    } else {
      out += `from dataclasses import dataclass\nfrom typing import List, Optional, Any\n\n`
      const classBlocks: string[] = []

      for (const [clsName, def] of classesMap.entries()) {
        let block = `@dataclass\nclass ${clsName}:\n`
        if (def.fields.length === 0) block += `    pass\n`

        for (const f of def.fields) {
          const propName = sanitizePropName(f.key)
          let pyType = 'Any'

          if (f.type === 'string') pyType = 'str'
          else if (f.type === 'integer') pyType = 'int'
          else if (f.type === 'number') pyType = 'float'
          else if (f.type === 'boolean') pyType = 'bool'
          else if (f.isNestedClass) pyType = f.type

          if (f.isArray) pyType = `List[${pyType}]`

          block += `    ${propName}: ${pyType}\n`
        }
        classBlocks.push(block)
      }
      out += classBlocks.reverse().join('\n')
      return { code: out.trim(), fileExtension: 'py', mimeType: 'text/x-python' }
    }
  }

  if (lang === 'typescript') {
    let out = ''
    const classBlocks: string[] = []

    for (const [clsName, def] of classesMap.entries()) {
      let block = `export interface ${clsName} {\n`
      for (const f of def.fields) {
        let tsType = 'any'

        if (f.type === 'string') tsType = 'string'
        else if (f.type === 'integer' || f.type === 'number') tsType = 'number'
        else if (f.type === 'boolean') tsType = 'boolean'
        else if (f.isNestedClass) tsType = f.type

        if (f.isArray) tsType = `${tsType}[]`

        block += `  ${f.key}: ${tsType};\n`
      }
      block += `}\n`
      classBlocks.push(block)
    }

    out = classBlocks.reverse().join('\n')
    return { code: out.trim(), fileExtension: 'ts', mimeType: 'text/typescript' }
  }

  if (lang === 'zod') {
    let out = `import { z } from 'zod';\n\n`
    const classBlocks: string[] = []

    for (const [clsName, def] of classesMap.entries()) {
      let block = `export const ${clsName}Schema = z.object({\n`
      for (const f of def.fields) {
        let zodType = 'z.any()'

        if (f.type === 'string') zodType = 'z.string()'
        else if (f.type === 'integer' || f.type === 'number') zodType = 'z.number()'
        else if (f.type === 'boolean') zodType = 'z.boolean()'
        else if (f.isNestedClass) zodType = `${f.type}Schema`

        if (f.isArray) zodType = `z.array(${zodType})`

        block += `  ${f.key}: ${zodType},\n`
      }
      block += `});\n\nexport type ${clsName} = z.infer<typeof ${clsName}Schema>;\n`
      classBlocks.push(block)
    }

    out += classBlocks.reverse().join('\n')
    return { code: out.trim(), fileExtension: 'ts', mimeType: 'text/typescript' }
  }

  if (lang === 'csharp') {
    let out = `using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\n`
    const classBlocks: string[] = []

    for (const [clsName, def] of classesMap.entries()) {
      let block = `public class ${clsName}\n{\n`
      for (const f of def.fields) {
        const propName = sanitizeClassName(f.key)
        let csType = 'object'

        if (f.type === 'string') csType = 'string'
        else if (f.type === 'integer') csType = 'long'
        else if (f.type === 'number') csType = 'double'
        else if (f.type === 'boolean') csType = 'bool'
        else if (f.isNestedClass) csType = f.type

        if (f.isArray) csType = `List<${csType}>`

        block += `    [JsonPropertyName("${f.key}")]\n`
        block += `    public ${csType} ${propName} { get; set; }\n\n`
      }
      block += `}\n`
      classBlocks.push(block)
    }

    out += classBlocks.reverse().join('\n')
    return { code: out.trim(), fileExtension: 'cs', mimeType: 'text/x-csharp' }
  }

  if (lang === 'go') {
    let out = `package main\n\n`
    const classBlocks: string[] = []

    for (const [clsName, def] of classesMap.entries()) {
      let block = `type ${clsName} struct {\n`
      for (const f of def.fields) {
        const fieldName = sanitizeClassName(f.key)
        let goType = 'interface{}'

        if (f.type === 'string') goType = 'string'
        else if (f.type === 'integer') goType = 'int64'
        else if (f.type === 'number') goType = 'float64'
        else if (f.type === 'boolean') goType = 'bool'
        else if (f.isNestedClass) goType = f.type

        if (f.isArray) goType = `[]${goType}`

        block += `\t${fieldName} ${goType} \`json:"${f.key}"\`\n`
      }
      block += `}\n`
      classBlocks.push(block)
    }

    out += classBlocks.reverse().join('\n')
    return { code: out.trim(), fileExtension: 'go', mimeType: 'text/x-go' }
  }

  if (lang === 'rust') {
    let out = `use serde::{Deserialize, Serialize};\n\n`
    const classBlocks: string[] = []

    for (const [clsName, def] of classesMap.entries()) {
      let block = `#[derive(Debug, Serialize, Deserialize)]\npub struct ${clsName} {\n`
      for (const f of def.fields) {
        const propName = sanitizePropName(f.key)
        let rustType = 'serde_json::Value'

        if (f.type === 'string') rustType = 'String'
        else if (f.type === 'integer') rustType = 'i64'
        else if (f.type === 'number') rustType = 'f64'
        else if (f.type === 'boolean') rustType = 'bool'
        else if (f.isNestedClass) rustType = f.type

        if (f.isArray) rustType = `Vec<${rustType}>`

        if (propName !== f.key) {
          block += `    #[serde(rename = "${f.key}")]\n`
        }
        block += `    pub ${propName}: ${rustType},\n`
      }
      block += `}\n`
      classBlocks.push(block)
    }

    out += classBlocks.reverse().join('\n')
    return { code: out.trim(), fileExtension: 'rs', mimeType: 'text/x-rust' }
  }

  // Fallback TypeScript
  return {
    code: `export interface ${rootName} {\n  [key: string]: any;\n}`,
    fileExtension: 'ts',
    mimeType: 'text/typescript',
  }
}

/**
 * Simple JSONPath query evaluation
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

    const arrayMatch = part.match(/^([^\[]*)(?:\[(\d+|\*)\])$/)
    if (arrayMatch) {
      const key = arrayMatch[1]
      const indexStr = arrayMatch[2]

      if (key) {
        current = current[key]
      }

      if (!Array.isArray(current)) return undefined

      if (indexStr === '*') {
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

    if (node.key && regex!.test(node.key)) {
      selfMatches = true
    }

    if (!selfMatches && node.type !== 'object' && node.type !== 'array' && node.value !== undefined) {
      if (regex!.test(String(node.value))) {
        selfMatches = true
      }
    }

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
      for (const ancestor of pathStack) {
        ancestorNodeIds.add(ancestor)
      }
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
