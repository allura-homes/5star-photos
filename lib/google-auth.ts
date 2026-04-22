export async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON

  if (!serviceAccountJson) {
    throw new Error("Missing GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON environment variable")
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson)

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Invalid service account JSON: missing client_email or private_key")
    }

    // Create JWT for OAuth 2.0
    const now = Math.floor(Date.now() / 1000)
    const header = {
      alg: "RS256",
      typ: "JWT",
    }

    const claim = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }

    // Import Web Crypto API for signing
    const encoder = new TextEncoder()
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
    const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
    const unsignedToken = `${headerB64}.${claimB64}`

    // Import private key
    const privateKeyPem = serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s/g, "")

    const binaryKey = Uint8Array.from(atob(privateKeyPem), (c) => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    )

    // Sign the token
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsignedToken))

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")

    const jwt = `${unsignedToken}.${signatureB64}`

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Failed to get access token: ${tokenResponse.status} ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    return tokenData.access_token
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON format - must be valid JSON")
    }
    throw error
  }
}
