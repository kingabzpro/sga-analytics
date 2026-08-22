import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required");
}

const templates = [
  {
    slugs: ["magic_link_sign_in", "magic_link_sign_up"],
    name: "SGA Analytics access link",
    subject: "Your SGA Analytics access link",
    markupFile: "../emails/clerk-magic-link.re.html",
    bodyFile: "../emails/clerk-magic-link.html",
  },
  {
    slugs: ["new_device_sign_in"],
    name: "SGA Analytics new sign-in notice",
    subject: "New sign-in to SGA Analytics",
    markupFile: "../emails/clerk-new-device.re.html",
    bodyFile: "../emails/clerk-new-device.html",
  },
];

for (const template of templates) {
  const markup = await readFile(
    fileURLToPath(new URL(template.markupFile, import.meta.url)),
    "utf8"
  );
  const body = await readFile(
    fileURLToPath(new URL(template.bodyFile, import.meta.url)),
    "utf8"
  );

  for (const slug of template.slugs) {
    const response = await fetch(`https://api.clerk.com/v1/templates/email/${slug}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Clerk-API-Version": "2026-05-12",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        markup,
        body,
        from_email_name: "notifications",
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Failed to update ${slug} (${response.status}): ${detail}`);
    }

    console.log(`Updated Clerk email template: ${slug}`);
  }
}
