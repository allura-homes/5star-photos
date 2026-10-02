const assert = require("node:assert/strict")
const { readFileSync, existsSync } = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const test = require("node:test")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

function render(file, exportName, auth) {
  const cache = new Map()
  const element = (tag) => ({ children, ...props }) => React.createElement(tag, props, children)
  const overrides = {
    "@/lib/contexts/auth-context": { useAuthContext: () => auth },
    "@/lib/actions/billing-actions": { changePlan: () => { throw new Error("Billing mutations are forbidden in render tests") } },
    "next/link": { default: element("a"), __esModule: true },
    "next/image": { default: element("img"), __esModule: true },
    "next/navigation": { usePathname: () => "/pricing", useRouter: () => ({}), useSearchParams: () => new URLSearchParams() },
    "@/components/header": { Header: () => React.createElement("header", null, "Header") },
    "@/components/sidebar": { Sidebar: () => React.createElement("aside", null, "Account sidebar") },
    "@/components/mobile-nav": { MobileNav: () => React.createElement("nav", null, "Account mobile tabs") },
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative)
    const exports = {}
    cache.set(relative, exports)
    const source = ts.transpileModule(readFileSync(path.join(__dirname, "..", relative), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(source, { exports, console, URLSearchParams, require: (id) => {
      if (overrides[id]) return overrides[id]
      if (id.startsWith("@/")) {
        const base = id.slice(2)
        const extension = [".ts", ".tsx"].find((ext) => existsSync(path.join(__dirname, "..", base + ext)))
        return load(base + extension)
      }
      return require(id)
    } }, { filename: relative })
    return exports
  }
  return renderToStaticMarkup(React.createElement(load(file)[exportName], null, React.createElement("p", null, "Page content")))
}

const guest = { isAuthenticated: false, isLoading: false, isProfileLoading: false, profile: null }

test("public shell keeps page content accessible without an account", () => {
  const html = render("components/public-page-shell.tsx", "PublicPageShell", guest)
  assert.ok(html.includes("Page content"))
  assert.ok(html.includes('href="/pricing"') && html.includes('href="/help"'))
  assert.ok(!html.includes("Account sidebar") && !html.includes("Account mobile tabs"))
})

test("signed-in shell retains desktop and mobile app navigation", () => {
  const html = render("components/public-page-shell.tsx", "PublicPageShell", { ...guest, isAuthenticated: true })
  assert.ok(html.includes("Account sidebar") && html.includes("Account mobile tabs"))
  assert.ok(html.includes("md:ml-20") && html.includes("pb-20"))
})

test("pricing shows a free offer and all monthly prices to guests", () => {
  const html = render("components/billing/pricing-table.tsx", "PricingTable", guest)
  for (const text of ["Start free", "$19", "$49", "$99", "50", "100", "270", "570"]) assert.ok(html.includes(text), text)
  assert.ok(html.includes('href="/auth/signup"'))
})

test("subscriber pricing marks the current plan and offers upgrades", () => {
  const html = render("components/billing/pricing-table.tsx", "PricingTable", { ...guest, isAuthenticated: true, profile: { plan: "pro", billing_interval: "month", subscription_status: "active" } })
  assert.ok(html.includes("Current plan"))
  assert.ok(html.includes("Upgrade to Max"))
  assert.ok(html.includes("Downgrade to Start-up"))
  assert.ok(html.includes('href="/account"'))
})

test("pricing blocks paid actions until the signed-in profile is known", () => {
  const html = render("components/billing/pricing-table.tsx", "PricingTable", { ...guest, isAuthenticated: true, isProfileLoading: true })
  assert.equal((html.match(/Loading your plan/g) || []).length, 3)
  assert.equal((html.match(/disabled=""/g) || []).length, 3)
})
