import { describe, expect, it } from 'vitest'
import {
  analyzeMetrics,
  autoRepairJson,
  buildGraphData,
  buildTree,
  compileSearchRegex,
  detectSecrets,
  generateJsonSchema,
  queryJsonPath,
  searchTreeNodes,
  validateJson,
} from './json-explorer.logic'

describe('json-explorer.logic', () => {
  it('validates valid JSON and returns parsed object', () => {
    const raw = '{"name": "Secure Toolkit", "version": 1.0, "active": true}'
    const res = validateJson(raw)
    expect(res.isValid).toBe(true)
    expect(res.parsed.name).toBe('Secure Toolkit')
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

  it('auto-repairs truncated JSON strings and missing closing braces/brackets', () => {
    const truncated = `{"app":"Secure Toolkit","security":{"apiEndpoint":"https:`
    const repaired = autoRepairJson(truncated)
    const val = validateJson(repaired)
    expect(val.isValid).toBe(true)
    expect(val.parsed.security.apiEndpoint).toBe('https:')
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
    const userNode = tree.children?.[0]
    expect(userNode?.key).toBe('user')
    expect(userNode?.children?.length).toBe(2)
  })

  it('analyzes structural metrics', () => {
    const data = { a: 1, b: { c: 'hello' }, d: [1, 2, 3] }
    const metrics = analyzeMetrics(data, JSON.stringify(data))
    expect(metrics.totalKeys).toBe(4)
    expect(metrics.maxDepth).toBe(2)
    expect(metrics.typeCounts.string).toBe(1)
    expect(metrics.typeCounts.number).toBe(4)
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
    expect(secrets.some((s) => s.type.includes('AWS Access Key'))).toBe(true)
    expect(secrets.some((s) => s.type.includes('JWT'))).toBe(true)
  })

  it('generates Draft-07 JSON Schema', () => {
    const data = { name: 'Alice', age: 25, active: true }
    const schema = generateJsonSchema(data)
    expect(schema.$schema).toContain('draft-07')
    expect(schema.properties.name.type).toBe('string')
    expect(schema.properties.age.type).toBe('integer')
  })

  it('evaluates JSONPath queries', () => {
    const data = { store: { book: [{ title: 'Book 1' }, { title: 'Book 2' }] } }
    expect(queryJsonPath(data, '$.store.book[0].title')).toBe('Book 1')
    expect(queryJsonPath(data, 'store.book[1].title')).toBe('Book 2')
  })

  it('builds node and edge graph data', () => {
    const data = { user: { name: 'Bob', age: 40 } }
    const graph = buildGraphData(data)
    expect(graph.nodes.length).toBeGreaterThan(1)
    expect(graph.edges.length).toBeGreaterThan(0)
  })

  it('compiles literal and regex search safely', () => {
    const literal = compileSearchRegex('hello.world', false, false)
    expect(literal.regex).toBeDefined()
    expect(literal.regex?.test('hello.world')).toBe(true)
    expect(literal.regex?.test('helloXworld')).toBe(false) // Dot is escaped

    const regexRes = compileSearchRegex('^user_\\d+$', true, false)
    expect(regexRes.regex).toBeDefined()
    expect(regexRes.regex?.test('USER_123')).toBe(true)

    const invalidRegex = compileSearchRegex('[unclosed', true, false)
    expect(invalidRegex.error).toBeDefined()
    expect(invalidRegex.regex).toBeUndefined()
  })

  it('searches tree nodes using regex and collects matches + ancestors', () => {
    const data = {
      app: 'Secure Toolkit',
      users: [
        { id: 101, email: 'alex@example.com' },
        { id: 102, email: 'sarah@domain.org' },
      ],
    }
    const root = buildTree(data)
    const result = searchTreeNodes(root, {
      query: '^[a-z]+@example\\.com$',
      isRegex: true,
      isCaseSensitive: false,
    })
    expect(result.totalMatches).toBe(1)
    expect(result.matchingNodeIds.has('$.users[0].email')).toBe(true)
    expect(result.ancestorNodeIds.has('$')).toBe(true)
    expect(result.ancestorNodeIds.has('$.users')).toBe(true)
  })
})
