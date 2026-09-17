const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { resolve } = require("node:path")
const { createRequire } = require("node:module")
const ts = require("typescript")

const root = resolve(__dirname, "..")
function loadTS(path, mocks = {}) {
  const filename = resolve(root, path)
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  const localRequire = (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name)
  new Function("require", "module", "exports", output)(localRequire, module, module.exports)
  return module.exports
}

async function main() {
  const { buildFaithfulEditPrompt } = loadTS("lib/faithful-edit-prompt.ts")
  for (const instructions of ["", "Do NOT add grass or furniture", "Make the lawn lush and fill in bare patches"]) {
    const prompt = buildFaithfulEditPrompt(instructions)
    assert.match(prompt, /bare soil stays bare soil/)
    assert.match(prompt, /White painted stair rails must remain white painted rails/)
    assert.match(prompt, /If a stylistic request conflicts with these rules, preserve the original/)
    assert.doesNotMatch(prompt, /You are performing VIRTUAL STAGING/)
  }

  const { friendlyModelError } = loadTS("lib/model-error.ts")
  assert.equal(await friendlyModelError(Response.json({ error: "This model is temporarily unavailable.", code: "MODEL_UNAVAILABLE" }, { status: 503 })), "This model is temporarily unavailable.")
  assert.match(await friendlyModelError(new Response("upstream failed", { status: 504 })), /took too long/)

  const unchanged = { addedVegetation: false, changedMaterials: false, changedStructureOrView: false, evidence: "No protected changes." }
  let verdict = unchanged
  let unavailable = false
  const mocked = loadTS("lib/vision/verify-property-fidelity.ts", {
    ai: { generateObject: async (options) => {
      assert.equal(options.messages[0].content[1].image.href, "https://example.com/original.jpg")
      assert.equal(options.messages[0].content[3].image.href, "https://example.com/edited.jpg")
      if (unavailable) throw new Error("review service unavailable")
      return { object: verdict }
    } },
  })
  const compare = () => mocked.verifyPropertyFidelity("https://example.com/original.jpg", "https://example.com/edited.jpg")
  await compare()
  for (const change of ["addedVegetation", "changedMaterials", "changedStructureOrView"]) {
    verdict = { ...unchanged, [change]: true }
    await assert.rejects(compare, (error) => error instanceof mocked.PropertyFidelityError && error.code === "PROPERTY_CHANGED")
  }
  unavailable = true
  await assert.rejects(compare, (error) => error.code === "FIDELITY_CHECK_UNAVAILABLE")

  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const renderBatch = (saved, status) => {
    let stateIndex = 0
    const states = [[{ id: "test", image: { original_filename: "test.jpg" }, status, progress: 100, completedVariations: saved, totalVariations: 4, modelErrors: saved < 4 ? ["V4: This model is temporarily unavailable."] : [] }], false, false, false, 100, null, [], null, false, null, false]
    const passthrough = ({ children }) => children
    const { default: BatchPage } = loadTS("app/batch-transform/page.tsx", {
      react: { ...React, useState: () => [states[stateIndex++], () => {}], useEffect: () => {}, useCallback: (fn) => fn },
      "next/navigation": { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() },
      "next/image": () => null,
      "next/link": ({ children, href }) => React.createElement("a", { href }, children),
      "@/lib/contexts/auth-context": { useAuthContext: () => ({ profile: null, user: null }) },
      "@/components/app-shell": { AppShell: passthrough },
      "@/lib/model-error": { friendlyModelError },
      "@/lib/batch-transform-handoff": {},
      "@/lib/actions/image-actions": {},
      "@/lib/actions/transform-actions": {},
      "@/components/billing/insufficient-credits-dialog": { InsufficientCreditsDialog: () => null },
      "@/lib/plans": { CREDIT_COSTS: { transform: 10 } },
      "@/lib/types": { DEFAULT_ENHANCEMENT_PREFERENCES: {} },
      "@/components/single-image-preferences-modal": { SingleImagePreferencesModal: () => null },
    })
    return renderToStaticMarkup(React.createElement(BatchPage))
  }
  const partial = renderBatch(3, "complete")
  assert.match(partial, /Batch finished with issues/)
  assert.match(partial, /3 of 4 variations saved/)
  assert.match(partial, /Partial result \(3\/4 variations saved\)/)
  assert.doesNotMatch(partial, /All Done!/)
  assert.match(renderBatch(4, "complete"), /All Done!/)
  assert.match(renderBatch(0, "error"), /0 of 4 variations saved/)
  console.log("PASS: preservation prompts, readable errors, all rejection categories, fail-closed review, and batch partial/success/failure rendering")

  // Optional live regression against a side-by-side screenshot supplied on the command line.
  if (process.argv[2]) {
    const sharp = createRequire(require.resolve("next"))("sharp")
    const response = await fetch(process.argv[2])
    assert.equal(response.ok, true)
    const screenshot = Buffer.from(await response.arrayBuffer())
    const { width, height } = await sharp(screenshot).metadata()
    const crop = async (left, top, w, h) => `data:image/jpeg;base64,${(await sharp(screenshot).extract({ left: Math.round(width * left), top: Math.round(height * top), width: Math.round(width * w), height: Math.round(height * h) }).jpeg().toBuffer()).toString("base64")}`
    const original = await crop(0.172, 0.213, 0.344, 0.355)
    const changed = await crop(0.533, 0.218, 0.343, 0.351)
    const live = loadTS("lib/vision/verify-property-fidelity.ts")
    await live.verifyPropertyFidelity(original, original)
    console.log("PASS: live reviewer accepts the unchanged original")
    await assert.rejects(() => live.verifyPropertyFidelity(original, changed), (error) => error.code === "PROPERTY_CHANGED")
    console.log("PASS: live reviewer rejects the altered porch in the supplied screenshot")
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
