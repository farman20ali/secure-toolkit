import { describe, expect, it } from 'vitest'
import {
  analyzeMetrics,
  autoRepairJson,
  buildGraphData,
  buildHierarchicalGraphData,
  buildTree,
  compileSearchRegex,
  detectSchemaDiff,
  detectSecrets,
  fixSchemaViolations,
  generateJsonSchema,
  generatePojoCode,
  queryJsonPath,
  searchTreeNodes,
  sortJsonKeys,
  stripJsonComments,
  validateAgainstSchema,
  validateJson,
} from './json-explorer.logic'

describe('json-explorer.logic', () => {
  it('validates valid JSON and returns parsed object', () => {
    const raw = '{"name": "Secure Toolkit", "version": 1.0, "active": true}'
    const res = validateJson(raw)
    expect(res.isValid).toBe(true)
    expect(res.parsed.name).toBe('Secure Toolkit')
  })

  it('accepts inline comments (-- and // and #) without failing validation', () => {
    const withComments = `{
      "name": "Secure Toolkit", // line comment
      "version": 1.2, -- SQL style comment
      "status": "active" # python style comment
    }`
    const res = validateJson(withComments)
    expect(res.isValid).toBe(true)
    expect(res.parsed.name).toBe('Secure Toolkit')
    expect(res.parsed.version).toBe(1.2)
    expect(res.parsed.status).toBe('active')
    expect(res.hadComments).toBe(true)
  })

  it('safely strips comments without corrupting URLs or string content', () => {
    const raw = `{
      "endpoint": "https://api.example.com/v1?test=1--2//3#4", // comment after value
      "sqlQuery": "SELECT * FROM users -- inline sql string" -- comment at end
    }`
    const stripped = stripJsonComments(raw)
    const parsed = JSON.parse(stripped)
    expect(parsed.endpoint).toBe('https://api.example.com/v1?test=1--2//3#4')
    expect(parsed.sqlQuery).toBe('SELECT * FROM users -- inline sql string')
  })

  it('detects JSON syntax error line and column', () => {
    const raw = '{\n  "name": "Test",\n  "invalid": \n}'
    const res = validateJson(raw)
    expect(res.isValid).toBe(false)
    expect(res.error).toBeDefined()
    expect(res.error?.line).toBeGreaterThanOrEqual(3)
  })

  it('auto-repairs unquoted keys, single quotes, trailing commas, and comments', () => {
    const broken = `
      // JS line comment
      {
        name: 'John Doe',
        age: 30,
        tags: ["admin", "user",], /* block comment */
      }
    `
    const repaired = autoRepairJson(broken)
    const val = validateJson(repaired)
    expect(val.isValid).toBe(true)
    expect(val.parsed.name).toBe('John Doe')
    expect(val.parsed.tags).toEqual(['admin', 'user'])
  })

  it('auto-repairs truncated JSON strings and missing closing braces/brackets preserving URLs', () => {
    const truncated = `{"app":"Secure Toolkit","security":{"apiEndpoint":"https:`
    const repaired = autoRepairJson(truncated)
    const val = validateJson(repaired)
    expect(val.isValid).toBe(true)
    expect(val.parsed.security.apiEndpoint).toBe('https:')
  })

  it('sorts JSON object keys recursively (A-Z and Z-A)', () => {
    const unsorted = {
      z: 1,
      a: { c: 3, b: 2 },
      m: [{ y: 2, x: 1 }],
    }

    const sortedAZ = sortJsonKeys(unsorted, false, true)
    expect(Object.keys(sortedAZ)).toEqual(['a', 'm', 'z'])
    expect(Object.keys(sortedAZ.a)).toEqual(['b', 'c'])
    expect(Object.keys(sortedAZ.m[0])).toEqual(['x', 'y'])

    const sortedZA = sortJsonKeys(unsorted, true, true)
    expect(Object.keys(sortedZA)).toEqual(['z', 'm', 'a'])
    expect(Object.keys(sortedZA.a)).toEqual(['c', 'b'])
  })

  it('generates Java POJO code with access modifiers, getters/setters, Lombok & Jackson', () => {
    const data = {
      name: 'Secure Toolkit',
      version: 1.2,
      config: { debug: false },
    }

    const res = generatePojoCode(data, {
      language: 'java',
      rootClassName: 'AppConfig',
      accessModifier: 'private',
      useLombok: true,
      useJackson: true,
    })

    expect(res.fileExtension).toBe('java')
    expect(res.code).toContain('@Data')
    expect(res.code).toContain('public class AppConfig')
    expect(res.code).toContain('private String name;')
    expect(res.code).toContain('@JsonProperty("version")')
  })

  it('generates Python Pydantic and Dataclasses code', () => {
    const data = { app: 'Demo', count: 10 }
    const pydanticRes = generatePojoCode(data, { language: 'python', usePydantic: true, rootClassName: 'DemoModel' })
    expect(pydanticRes.fileExtension).toBe('py')
    expect(pydanticRes.code).toContain('class DemoModel(BaseModel):')

    const dataclassRes = generatePojoCode(data, { language: 'python', usePydantic: false, rootClassName: 'DemoModel' })
    expect(dataclassRes.code).toContain('@dataclass')
    expect(dataclassRes.code).toContain('class DemoModel:')
  })

  it('generates TypeScript and Zod Schema code', () => {
    const data = { id: 1, name: 'Alex', roles: ['admin'] }
    const tsRes = generatePojoCode(data, { language: 'typescript', rootClassName: 'User' })
    expect(tsRes.code).toContain('export interface User')
    expect(tsRes.code).toContain('id: number;')

    const zodRes = generatePojoCode(data, { language: 'zod', rootClassName: 'User' })
    expect(zodRes.code).toContain('export const UserSchema = z.object({')
    expect(zodRes.code).toContain('id: z.number()')
  })

  it('builds structured flowchart graph topology with connecting edge coordinates', () => {
    const data = {
      user: {
        id: 101,
        details: { email: 'alex@example.com' },
      },
    }

    const flowData = buildHierarchicalGraphData(data)
    expect(flowData.nodes.length).toBeGreaterThanOrEqual(3) // root, user, details
    expect(flowData.edges.length).toBeGreaterThanOrEqual(2)
    const edge = flowData.edges[0]
    expect(edge.sourceX).toBeGreaterThan(0)
    expect(edge.targetX).toBeGreaterThan(edge.sourceX)
  })

  it('validates JSON against Schema using SchemaGuard logic', () => {
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number', minimum: 18 },
        role: { type: 'string', enum: ['admin', 'user'] },
      },
    }

    const validData = { name: 'Alice', age: 25, role: 'admin' }
    const validRes = validateAgainstSchema(validData, schema)
    expect(validRes.isValid).toBe(true)

    const invalidData = { name: 'Bob', age: 15, role: 'guest' }
    const invalidRes = validateAgainstSchema(invalidData, schema)
    expect(invalidRes.isValid).toBe(false)
  })

  it('auto-fixes schema violations', () => {
    const schema = {
      type: 'object',
      required: ['name', 'count', 'active'],
      properties: {
        name: { type: 'string' },
        count: { type: 'integer', minimum: 1 },
        active: { type: 'boolean' },
      },
    }

    const partialData = { name: 'Partial Data' }
    const fixed = fixSchemaViolations(partialData, schema)
    expect(fixed.name).toBe('Partial Data')
    expect(fixed.count).toBe(1)
    expect(fixed.active).toBe(false)
  })

  it('detects structural schema drift', () => {
    const schema = {
      type: 'object',
      required: ['id', 'email'],
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
      },
      additionalProperties: false,
    }

    const driftingData = { id: 101, extraProp: 'hello' }
    const diffs = detectSchemaDiff(driftingData, schema)
    expect(diffs.some((d) => d.type === 'missing_key')).toBe(true)
    expect(diffs.some((d) => d.type === 'extra_key')).toBe(true)
  })

  it('builds tree hierarchy correctly', () => {
    const data = {
      user: {
        id: 101,
        roles: ['admin', 'dev'],
      },
    }
    const tree = buildTree(data)
    expect(tree.type).toBe('object')
    expect(tree.children?.length).toBe(1)
  })

  it('analyzes structural metrics', () => {
    const data = { a: 1, b: { c: 'hello' }, d: [1, 2, 3] }
    const metrics = analyzeMetrics(data, JSON.stringify(data))
    expect(metrics.totalKeys).toBe(4)
    expect(metrics.maxDepth).toBe(2)
  })

  it('detects embedded secrets and API keys inside JSON', () => {
    const data = {
      api: {
        key: 'AKIA1234567890ABCDEF',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        secret_password: 'supersecretpass',
      },
    }
    const secrets = detectSecrets(data)
    expect(secrets.length).toBeGreaterThanOrEqual(3)
  })

  it('generates Draft-07 JSON Schema', () => {
    const data = { name: 'Alice', age: 25, active: true }
    const schema = generateJsonSchema(data)
    expect(schema.$schema).toContain('draft-07')
  })

  it('evaluates JSONPath queries', () => {
    const data = { store: { book: [{ title: 'Book 1' }, { title: 'Book 2' }] } }
    expect(queryJsonPath(data, '$.store.book[0].title')).toBe('Book 1')
  })

  it('builds node and edge graph data', () => {
    const data = { user: { name: 'Bob', age: 40 } }
    const graph = buildGraphData(data)
    expect(graph.nodes.length).toBeGreaterThan(1)
  })

  it('compiles literal and regex search safely', () => {
    const literal = compileSearchRegex('hello.world', false, false)
    expect(literal.regex).toBeDefined()
  })

  it('searches tree nodes using regex', () => {
    const data = {
      app: 'Secure Toolkit',
      users: [{ id: 101, email: 'alex@example.com' }],
    }
    const root = buildTree(data)
    const result = searchTreeNodes(root, {
      query: '^[a-z]+@example\\.com$',
      isRegex: true,
      isCaseSensitive: false,
    })
    expect(result.totalMatches).toBe(1)
  })
})
