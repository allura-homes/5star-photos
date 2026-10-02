const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const test = require("node:test")
const ts = require("typescript")
const { NextRequest } = require("next/server")

function load(file, { env = {}, fetch: send = () => { throw new Error("Unexpected provider call") } } = {}) {
  const source = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  const sandbox = {
    exports, Buffer, AbortSignal, Uint8Array,
    process: { env }, fetch: send,
    console: { error() {} },
    require: (id) => id === "@/lib/contact" ? load("lib/contact.ts") : require(id),
  }
  vm.runInNewContext(source, sandbox, { filename: file })
  return exports
}

const input = { name: "Website QA", email: "delivered@resend.dev", topic: "General question", message: "Please help me understand credit usage.", website: "" }
const configured = { RESEND_API_KEY: "test-only-not-a-real-key", CONTACT_FROM_EMAIL: "support@example.com" }
function request(data = input, headers = {}) {
  return new NextRequest("https://5star.photos/api/contact", {
    method: "POST", body: typeof data === "string" ? data : JSON.stringify(data),
    headers: { origin: "https://5star.photos", "content-type": "application/json", "x-forwarded-for": "192.0.2.1", ...headers },
  })
}

test("contact endpoint validates before calling the provider", async () => {
  const { POST } = load("app/api/contact/route.ts")
  assert.equal((await POST(request(input, { origin: "https://attacker.example" }))).status, 403)
  assert.equal((await POST(request(input, { "content-type": "text/plain" }))).status, 415)
  assert.equal((await POST(request("not json"))).status, 400)
  assert.equal((await POST(request({ ...input, email: "invalid", message: "short" }))).status, 400)
  assert.equal((await POST(request({ ...input, name: "Name\r\nInjected" }))).status, 400)
  assert.equal((await POST(request({ ...input, website: "spam.example" }))).status, 400)
  assert.equal((await POST(request({ ...input, to: "attacker@example.com" }))).status, 400)
  assert.equal((await POST(request("x".repeat(32769)))).status, 413)
  assert.equal((await POST(request())).status, 503)
})

test("valid contact sends only to the fixed support mailbox with Reply-To", async () => {
  const calls = []
  const { POST } = load("app/api/contact/route.ts", { env: configured, fetch: async (url, options) => {
    calls.push({ url, options })
    return Response.json({ id: "test-email-id" })
  } })
  assert.equal((await POST(request())).status, 200)
  assert.equal((await POST(request())).status, 200)
  assert.equal(calls.length, 2)
  const body = JSON.parse(calls[0].options.body)
  assert.equal(calls[0].url, "https://api.resend.com/emails")
  assert.deepEqual(body.to, ["5star.photos@allurahomes.com"])
  assert.equal(body.reply_to, input.email)
  assert.equal(body.from, "5star.photos <support@example.com>")
  assert.ok(body.text.includes(input.message))
  assert.equal(body.html, undefined)
  assert.equal(calls[0].options.headers["Idempotency-Key"], calls[1].options.headers["Idempotency-Key"])
  assert.ok(!calls[0].options.headers["Idempotency-Key"].includes("192.0.2.1"))
})

test("provider failures never produce a false success or leak details", async () => {
  for (const status of [401, 403, 429, 409, 500]) {
    const { POST } = load("app/api/contact/route.ts", { env: configured, fetch: async () => Response.json({ message: "private provider detail" }, { status }) })
    const response = await POST(request())
    assert.equal(response.status, [429, 409].includes(status) ? 429 : 502)
    const body = await response.json()
    assert.notEqual(body.ok, true)
    assert.ok(!body.error.includes("private provider detail"))
  }
  const { POST } = load("app/api/contact/route.ts", { env: configured, fetch: async () => { throw new Error("timeout") } })
  assert.equal((await POST(request())).status, 502)
})
