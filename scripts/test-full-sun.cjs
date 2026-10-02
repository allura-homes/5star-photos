const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { resolve } = require("node:path")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

const root = resolve(__dirname, "..")
function loadTS(path, mocks = {}, extra = "") {
  const filename = resolve(root, path)
  const output = ts.transpileModule(readFileSync(filename, "utf8") + extra, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function("require", "module", "exports", output)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports,
  )
  return module.exports
}

async function main() {
  const lighting = loadTS("lib/faithful-edit-prompt.ts")
  const { FULL_SUN_INSTRUCTIONS, FULL_SUN_MARKER, applyFullSunLighting, getWindowLightingGuidance, buildFaithfulEditPrompt } = lighting
  const fullSun = applyFullSunLighting("Original is a dark twilight photo.", "clear_blue")
  assert.ok(fullSun.endsWith(FULL_SUN_INSTRUCTIONS))
  assert.equal(applyFullSunLighting(fullSun, "clear_blue"), fullSun)
  for (const option of [undefined, "none", "dramatic_clouds", "golden_hour", "twilight", "invalid"]) {
    assert.equal(applyFullSunLighting("Keep this prompt", option), "Keep this prompt")
  }
  for (const requirement of [/solar noon/, /not just cloud removal/, /OFF-CAMERA/, /bounce boards/, /contact shadows/, /neutral whites/, /never render boards/, /bare ground patch/, /interior photograph, skip/]) {
    assert.match(FULL_SUN_INSTRUCTIONS, requirement)
  }
  assert.match(getWindowLightingGuidance(fullSun), /DAYTIME/)
  assert.doesNotMatch(getWindowLightingGuidance(fullSun), /^Windows should glow/)
  assert.match(getWindowLightingGuidance("Requested twilight transformation"), /^Windows should glow/)
  assert.match(buildFaithfulEditPrompt(fullSun), /bare soil stays bare soil/)
  assert.match(buildFaithfulEditPrompt(fullSun), /White painted stair rails must remain white painted rails/)

  const originalFetch = global.fetch
  const previousKeys = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY }
  const originalConsole = { log: console.log, warn: console.warn, error: console.error }
  try {
    process.env.OPENAI_API_KEY = "test-only-no-network"
    process.env.GOOGLE_CLOUD_API_KEY = "test-only-no-network"
    console.log = console.warn = console.error = () => {}
    let directorMode = "success"
    const submissions = []
    global.fetch = async (url, options) => {
      if (String(url).includes("gemini-2.5-flash:")) {
        const analysis = JSON.parse(options.body).contents[0].parts[0].text
        assert.ok(analysis.includes(FULL_SUN_INSTRUCTIONS))
        if (directorMode === "unavailable") return new Response("Unavailable", { status: 503 })
        const text = directorMode === "malformed" ? "not json" : directorMode === "invalid-schema" ? '{"imagePrompt":42}' : '{"imagePrompt":"Improve the original dim twilight scene."}'
        return Response.json({ candidates: [{ content: { parts: [{ text }] } }] })
      }
      if (String(url).includes("api.openai.com/v1/images/edits")) {
        submissions.push({ model: options.body.get("model"), prompt: options.body.get("prompt"), fidelity: options.body.get("input_fidelity") })
        return Response.json({ data: [{ b64_json: "dGVzdA==" }] })
      }
      if (String(url).includes("gemini-3-pro-image-preview:")) {
        const body = JSON.parse(options.body)
        submissions.push({ model: "gemini-3-pro-image-preview", prompt: body.contents[0].parts.find((part) => part.text).text })
        return Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: "dGVzdA==" } }] } }] })
      }
      if (String(url) === "https://example.test/original.jpg" || String(url).startsWith("https://res.cloudinary.com/")) {
        return new Response(new Uint8Array([255, 216, 255, 217]), { headers: { "Content-Type": "image/jpeg" } })
      }
      throw new Error(`Unexpected network request: ${url}`)
    }

    const director = loadTS("app/api/art-director/route.ts", {
      "@/lib/api-auth": { requireUser: async () => ({ ok: true }) },
      "@/lib/faithful-edit-prompt": lighting,
    })
    for (directorMode of ["success", "unavailable", "malformed", "invalid-schema"]) {
      const response = await director.POST({ json: async () => ({ filename: "IMG_1234.jpg", user_preferences: { skyReplacement: "clear_blue" } }) })
      assert.equal(response.status, 200)
      assert.ok((await response.json()).imagePrompt.includes(FULL_SUN_INSTRUCTIONS), `${directorMode} lost Full Sun`)
    }
    delete process.env.GOOGLE_CLOUD_API_KEY
    const noKey = await director.POST({ json: async () => ({ filename: "exterior.jpg", user_preferences: { skyReplacement: "clear_blue" } }) })
    assert.ok((await noKey.json()).imagePrompt.includes(FULL_SUN_INSTRUCTIONS))
    process.env.GOOGLE_CLOUD_API_KEY = "test-only-no-network"

    const models = loadTS("lib/constants/models.ts")
    let fidelityChecks = 0
    const editor = loadTS("app/api/edit-image/route.ts", {
      "@/lib/api-auth": {},
      "@/lib/storage/upload-data-url": {},
      "@/lib/supabase/direct": {},
      "@/lib/faithful-edit-prompt": lighting,
      "@/lib/vision/verify-property-fidelity": {
        PropertyFidelityError: class extends Error {},
        verifyPropertyFidelity: async (original, edited) => {
          assert.equal(original, "https://example.test/original.jpg")
          assert.match(edited, /^data:image\/png;base64,/)
          fidelityChecks++
        },
      },
      "@/lib/constants/models": models,
    }, "\nexports.testRunEditImage = runEditImage;\n")
    for (const model of models.ACTIVE_MODELS) {
      const response = await editor.testRunEditImage({
        original_url: "https://example.test/original.jpg", filename: "test.jpg", provider: model.provider,
        image_prompt: "Original is a dim twilight exterior. Improve the photo.", sky_replacement: "clear_blue",
      })
      assert.equal(response.status, 200, model.label)
      const submitted = submissions.at(-1)
      assert.ok(submitted.prompt.includes(FULL_SUN_INSTRUCTIONS), `${model.label} lost Full Sun at provider boundary`)
      assert.match(submitted.prompt, /PROPERTY FIDELITY IS MORE IMPORTANT THAN BEAUTIFICATION/)
      assert.match(submitted.prompt, /bare soil stays bare soil/)
      if (model.provider === "nano_banana_pro") {
        assert.equal(submitted.model, "gemini-3-pro-image-preview")
        assert.match(submitted.prompt, /This is a DAYTIME photo/)
        assert.doesNotMatch(submitted.prompt, /Windows should glow with warm/)
      } else {
        assert.equal(submitted.model, model.modelId)
      }
      if (model.provider === "openai_1_5") assert.equal(submitted.fidelity, "high")
    }
    assert.equal(submissions.length, 4)
    assert.equal(fidelityChecks, 4)
  } finally {
    global.fetch = originalFetch
    Object.assign(console, originalConsole)
    for (const [key, value] of Object.entries(previousKeys)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }

  const types = loadTS("lib/types.ts", { "@/lib/plans": {} })
  const utils = loadTS("lib/utils.ts")
  for (const selected of ["none", "clear_blue", "golden_hour"]) {
    let stateIndex = 0
    const preferences = { ...types.DEFAULT_ENHANCEMENT_PREFERENCES, skyReplacement: selected }
    let changedPreferences
    const modal = loadTS("components/single-image-preferences-modal.tsx", {
      react: { ...React, useEffect: () => {}, useState: () => [[preferences, false, null][stateIndex++], (update) => { changedPreferences = typeof update === "function" ? update(preferences) : update }] },
      "@/lib/types": types, "@/lib/utils": utils, "next/image": () => null,
    })
    const props = { isOpen: true, classification: "outdoor", imageName: "test.jpg", onClose() {}, onConfirm() {} }
    const html = renderToStaticMarkup(React.createElement(modal.SingleImagePreferencesModal, props))
    assert.match(html, /Full Sun/)
    assert.doesNotMatch(html, /Clear Blue/)
    assert.equal(html.includes("Full Sun relights outdoor photos"), selected === "clear_blue")
    stateIndex = 0
    const tree = modal.SingleImagePreferencesModal(props)
    const findButton = (node) => {
      if (!node || typeof node !== "object") return null
      if (Array.isArray(node)) return node.map(findButton).find(Boolean)
      if (node.type === "button" && React.Children.toArray(node.props.children).includes("Full Sun")) return node
      return findButton(node.props?.children)
    }
    const button = findButton(tree)
    assert.ok(button)
    assert.equal(button.props["aria-pressed"], selected === "clear_blue")
    button.props.onClick()
    assert.equal(changedPreferences.skyReplacement, "clear_blue")
  }
  console.log("PASS: Full Sun selection/help, saved-key compatibility, all four provider request prompts, Nano Banana daylight, director success/fallbacks, and preservation rules (mocked providers; no paid generations).")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
