import { z } from "zod"

export const SUPPORT_EMAIL = "5star.photos@allurahomes.com"
export const CONTACT_TOPICS = ["General question", "Photo enhancement", "Credits & billing", "Account & sign-in", "Something else"] as const

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100, "Use 100 characters or fewer.").regex(/^[^\r\n\x00-\x1f]*$/, "Please enter a valid name."),
  email: z.string().trim().email("Please enter a valid email address.").max(254),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10, "Please add a little more detail (at least 10 characters).").max(5000, "Please keep your message under 5,000 characters."),
  website: z.string().max(200).default(""),
}).strict()

export type ContactInput = z.infer<typeof contactSchema>
