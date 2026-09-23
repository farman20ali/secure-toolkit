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
  extractJsonFromText,
  fixSchemaViolations,
  formatJsonPreservingComments,
  generateJsonSchema,
  generatePojoCode,
  parseJavaDtoToJson,
  queryJsonPath,
  searchTreeNodes,
  sortJsonKeys,
  sortJsonKeysPreservingComments,
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

  it('converts Java DTO toString representations to valid JSON', () => {
    const input = `UserSessionDto[sessionId=9876543210123, userId=4521, username=alex_mercer,
status=ACTIVE, statusTimeStamp=2026-09-23 11:45:38,
lastLoginTimeStamp=2026-09-23 11:45:38, rrn=2785423, channelId=WEB_PORTAL,
transactionType=userSessionConfluent]`

    const res = parseJavaDtoToJson(input)
    expect(res.success).toBe(true)
    expect(res.parsed).toEqual({
      sessionId: '9876543210123',
      userId: 4521,
      username: 'alex_mercer',
      status: 'ACTIVE',
      statusTimeStamp: '2026-09-23 11:45:38',
      lastLoginTimeStamp: '2026-09-23 11:45:38',
      rrn: 2785423,
      channelId: 'WEB_PORTAL',
      transactionType: 'userSessionConfluent',
    })
  })

  it('tolerates surrounding text and optional outer curly braces in Java DTO input', () => {
    const surrounded = `some random log text
UserSessionDto[sessionId=9876543210123, userId=4521]
some additional log text`

    const resSurrounded = parseJavaDtoToJson(surrounded)
    expect(resSurrounded.success).toBe(true)
    expect(resSurrounded.parsed.sessionId).toBe('9876543210123')
    expect(resSurrounded.parsed.userId).toBe(4521)

    const logLineWithTags = `2026-09-23 11:45:38 [INFO] Kafka Payload Received: UserSessionDto[sessionId=9876543210123, status=ACTIVE] - Processing finished.`
    const resLog = parseJavaDtoToJson(logLineWithTags)
    expect(resLog.success).toBe(true)
    expect(resLog.parsed.sessionId).toBe('9876543210123')
    expect(resLog.parsed.status).toBe('ACTIVE')

    const logLineWithLoggerName = `2026-09-23 11:45:38 farman[INFO] Kafka Payload Received: UserSessionDto[sessionId=9876543210123, status=ACTIVE] - Processing finished.`
    const resLoggerName = parseJavaDtoToJson(logLineWithLoggerName)
    expect(resLoggerName.success).toBe(true)
    expect(resLoggerName.parsed.sessionId).toBe('9876543210123')
    expect(resLoggerName.parsed.status).toBe('ACTIVE')

    const wrappedBraces = `{UserSessionDto[userId=4521, status=ACTIVE]}`
    const resWrapped = parseJavaDtoToJson(wrappedBraces)
    expect(resWrapped.success).toBe(true)
    expect(resWrapped.parsed.userId).toBe(4521)
    expect(resWrapped.parsed.status).toBe('ACTIVE')
  })

  it('parses nested DTOs and collections correctly', () => {
    const nested = `UserDto[id=123, address=Address[city="San Francisco", country="USA"], active=true, tags=[admin, user]]`
    const res = parseJavaDtoToJson(nested)
    expect(res.success).toBe(true)
    expect(res.parsed).toEqual({
      id: 123,
      address: { city: 'San Francisco', country: 'USA' },
      active: true,
      tags: ['admin', 'user'],
    })

    const listDto = `ResponseDto[data=[Item[id=1], Item[id=2]], status=SUCCESS]`
    const resList = parseJavaDtoToJson(listDto)
    expect(resList.success).toBe(true)
    expect(resList.parsed).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      status: 'SUCCESS',
    })
  })

  it('extracts JSON surrounded by irrelevant log text', () => {
    const raw = `some irrelevant log text
{
  "status": "ok",
  "code": 200
}
some text at the end`

    const extracted = extractJsonFromText(raw)
    expect(extracted).not.toBeNull()
    const parsed = JSON.parse(extracted!)
    expect(parsed.status).toBe('ok')
    expect(parsed.code).toBe(200)

    const repaired = autoRepairJson(raw)
    const val = validateJson(repaired)
    expect(val.isValid).toBe(true)
    expect(val.parsed.status).toBe('ok')
  })

  it('preserves comments by default during auto-repair', () => {
    const jsonWithComments = `{
      // Main user name comment
      name: 'John Doe', // user's full name
      age: 30, # age in years
      tags: ["admin", "user",], /* block comment */
    }`

    const repaired = autoRepairJson(jsonWithComments)
    expect(repaired).toContain('// Main user name comment')
    expect(repaired).toContain("// user's full name")
    expect(repaired).toContain('/* block comment */')

    const val = validateJson(repaired)
    expect(val.isValid).toBe(true)
    expect(val.parsed.name).toBe('John Doe')
    expect(val.parsed.age).toBe(30)
  })

  it('strips comments on demand when stripComments option is true', () => {
    const jsonWithComments = `{
      // Line comment
      name: 'John Doe', /* Block comment */
    }`

    const stripped = autoRepairJson(jsonWithComments, { stripComments: true })
    expect(stripped).not.toContain('Line comment')
    expect(stripped).not.toContain('Block comment')
  })

  it('fixes stray single slashes (/ afaf, /2324) during auto-repair', () => {
    const brokenSlashes = `{
      name: 'John', / afaf
      count: 10, /2324
    }`

    const repaired = autoRepairJson(brokenSlashes)
    const val = validateJson(repaired)
    expect(val.isValid).toBe(true)
    expect(val.parsed.name).toBe('John')
    expect(val.parsed.count).toBe(10)
  })

  it('preserves root JSON payload structure and keys when auto-repairing syntax errors on root properties', () => {
    const brokenQuoteRoot = `{
      "app": "Secure Toolkit, // Main application name
      "version": 1.2,
      "config": {
        "maxConnections": 50
      },
      "security": {
        "mfaEnabled": true
      }
    }`

    const repairedQuote = autoRepairJson(brokenQuoteRoot)
    const valQuote = validateJson(repairedQuote)
    expect(valQuote.isValid).toBe(true)
    expect(valQuote.parsed.app).toBeDefined()
    expect(valQuote.parsed.config).toBeDefined()
    expect(valQuote.parsed.security).toBeDefined()

    const brokenSlashRoot = `{
      "app": "Secure Toolkit" / farman
      "version": 1.2,
      "config": {
        "maxConnections": 50
      }
    }`

    const repairedSlash = autoRepairJson(brokenSlashRoot)
    const valSlash = validateJson(repairedSlash)
    expect(valSlash.isValid).toBe(true)
    expect(valSlash.parsed.app).toBe('Secure Toolkit')
    expect(valSlash.parsed.config.maxConnections).toBe(50)
  })

  it('formats JSON while preserving all line and inline comments', () => {
    const rawWithComments = `{
"app": "Secure Toolkit", // Main app
"version": 1.2, -- current version
"status": "active" # system status
}`
    const formatted = formatJsonPreservingComments(rawWithComments, 2)
    expect(formatted).toContain('// Main app')
    expect(formatted).toContain('-- current version')
    expect(formatted).toContain('# system status')
    expect(formatted).toContain('  "app": "Secure Toolkit",')

    const val = validateJson(formatted)
    expect(val.isValid).toBe(true)
    expect(val.parsed.app).toBe('Secure Toolkit')
  })

  it('sorts JSON keys (A-Z and Z-A) while preserving leading and inline comments on properties', () => {
    const unsortedWithComments = `{
  "version": 1.2, // version comment
  // Main title comment
  "app": "Secure Toolkit",
  "status": "active" # status comment
}`

    const sortedAZ = sortJsonKeysPreservingComments(unsortedWithComments, false, 2)
    expect(sortedAZ).toContain('// Main title comment')
    expect(sortedAZ).toContain('// version comment')
    expect(sortedAZ).toContain('# status comment')

    const linesAZ = sortedAZ.split('\n').map((l) => l.trim())
    const appIdx = linesAZ.findIndex((l) => l.includes('"app"'))
    const statusIdx = linesAZ.findIndex((l) => l.includes('"status"'))
    const versionIdx = linesAZ.findIndex((l) => l.includes('"version"'))

    expect(appIdx).toBeLessThan(statusIdx)
    expect(statusIdx).toBeLessThan(versionIdx)

    const valAZ = validateJson(sortedAZ)
    expect(valAZ.isValid).toBe(true)
    expect(valAZ.parsed.app).toBe('Secure Toolkit')
    expect(valAZ.parsed.version).toBe(1.2)

    const sortedZA = sortJsonKeysPreservingComments(unsortedWithComments, true, 2)
    const linesZA = sortedZA.split('\n').map((l) => l.trim())
    const appIdxZA = linesZA.findIndex((l) => l.includes('"app"'))
    const versionIdxZA = linesZA.findIndex((l) => l.includes('"version"'))

    expect(versionIdxZA).toBeLessThan(appIdxZA)

    const valZA = validateJson(sortedZA)
    expect(valZA.isValid).toBe(true)
  })
})


