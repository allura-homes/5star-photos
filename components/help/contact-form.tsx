"use client"

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CONTACT_TOPICS, SUPPORT_EMAIL, contactSchema, type ContactInput } from "@/lib/contact"

type FieldErrors = Partial<Record<keyof ContactInput, string[]>>

export function ContactForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const parsed = contactSchema.safeParse(Object.fromEntries(new FormData(form)))
    setError("")
    setFieldErrors({})
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setFieldErrors(fields)
      form.querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)?.focus()
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(20_000),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        if (result.fields) setFieldErrors(result.fields)
        throw new Error(result.error || "Your message could not be sent. Please try again.")
      }
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Sending timed out. Please try again in a moment, or email us directly.")
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5" role="status" aria-live="polite">
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Message sent</AlertTitle>
          <AlertDescription>Thanks for getting in touch. Our team will reply to the email address you provided.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => setSent(false)}>Send another message</Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={pending} className="flex flex-col gap-6">
      <fieldset disabled={pending} className="min-w-0">
        <legend className="sr-only">Contact details and message</legend>
        <FieldGroup>
          <Field data-invalid={!!fieldErrors.name}>
            <FieldLabel htmlFor="contact-name">Your name</FieldLabel>
            <Input id="contact-name" name="name" autoComplete="name" placeholder="Your name" required maxLength={100} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "contact-name-error" : undefined} />
            <FieldError id="contact-name-error">{fieldErrors.name?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.email}>
            <FieldLabel htmlFor="contact-email">Email address</FieldLabel>
            <Input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "contact-email-error" : "contact-email-hint"} />
            <FieldDescription id="contact-email-hint">Where should we send our reply?</FieldDescription>
            <FieldError id="contact-email-error">{fieldErrors.email?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.topic}>
            <FieldLabel htmlFor="contact-topic">What is this about?</FieldLabel>
            <select id="contact-topic" name="topic" defaultValue={CONTACT_TOPICS[0]} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-invalid={!!fieldErrors.topic} aria-describedby={fieldErrors.topic ? "contact-topic-error" : undefined}>
              {CONTACT_TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
            </select>
            <FieldError id="contact-topic-error">{fieldErrors.topic?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.message}>
            <FieldLabel htmlFor="contact-message">Your message</FieldLabel>
            <Textarea id="contact-message" name="message" placeholder="Tell us what happened or how we can help…" rows={5} className="min-h-36 resize-y" required minLength={10} maxLength={5000} aria-invalid={!!fieldErrors.message} aria-describedby={fieldErrors.message ? "contact-message-error" : "contact-message-hint"} />
            <FieldDescription id="contact-message-hint">Please do not include passwords or payment card details.</FieldDescription>
            <FieldError id="contact-message-error">{fieldErrors.message?.[0]}</FieldError>
          </Field>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="contact-website">Leave this field empty</label>
            <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
        </FieldGroup>
      </fieldset>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Message not sent</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="break-all underline underline-offset-4">Email {SUPPORT_EMAIL} instead</a>
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        {pending ? "Sending message…" : "Send message"}
      </Button>
      <p className="text-sm leading-relaxed text-muted-foreground">We use your details to respond to this request. See our <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
    </form>
  )
}
