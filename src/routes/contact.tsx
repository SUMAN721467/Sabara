import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Mail, Instagram, Phone } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const Route = createFileRoute("/contact")({
  component: Contact,
  head: () => ({
    meta: [
      { title: "Contact · Sabara" },
      { name: "description", content: "Get in touch with the Sabara workshop." },
    ],
  }),
});

function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      message: formData.get("message") as string,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Server error: ${text.substring(0, 150)}`);
      }

      if (res.ok && result.success) {
        toast.success("Thanks — we'll be in touch soon.");
        form.reset();
      } else {
        toast.error(result.error || "Failed to send message.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="grid gap-12 md:grid-cols-2 md:gap-20">
        <ScrollReveal variant="fade-right" duration={800}>
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
              Say hello
            </span>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground md:text-5xl">
              We&rsquo;d love to hear from you.
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
              Handcrafted with tradition and care, Sabara brings timeless Sabai grass craftsmanship into modern homes.

For custom orders, exhibitions, collaborations, wholesale enquiries, or any assistance — feel free to reach out to us.
            </p>

            <ul className="mt-10 space-y-4 text-sm">
              <li className="flex items-start gap-3 group">
                <MapPin className="mt-0.5 h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                <div>
                  <div className="text-foreground transition-colors group-hover:text-primary duration-300">Sabara -by Laxmi Bishnu Mat Weaving</div>
                  <div className="text-muted-foreground">NankarNila,Sabang,Paschim Medinipur 721467,West Bengal,India</div>
                </div>
              </li>
              <li className="flex items-start gap-3 group">
                <Mail className="mt-0.5 h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                <a className="text-foreground transition-colors group-hover:text-primary duration-300 hover:underline" href="mailto:contact.sabara@gmail.com">
                  contact.sabara@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3 group">
                <Phone className="mt-0.5 h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                <a className="text-foreground transition-colors group-hover:text-primary duration-300 hover:underline" href="tel:+916294359714">
                  +91 62943 59714
                </a>
              </li>
              <li className="flex items-start gap-3 group">
                <Instagram className="mt-0.5 h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                <a className="text-foreground transition-colors group-hover:text-primary duration-300 hover:underline" href="https://www.instagram.com/sabara.in?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==">
                  @sabara.in
                </a>
              </li>
            </ul>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fade-left" duration={800} delay={100}>
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm transition-shadow duration-300 hover:shadow-md"
          >
            <div className="grid gap-4">
              <Field label="Name" name="name" required />
              <Field label="Email" name="email" type="email" required />
              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Message
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  className="rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                disabled={isSubmitting}
                className="mt-2 w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/95 hover:scale-[1.02] active:scale-98 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        </ScrollReveal>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="h-11 rounded-md border border-border bg-background px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
