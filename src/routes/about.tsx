import { createFileRoute, Link } from "@tanstack/react-router";
import craft from "@/assets/craft.jpg";
import hero from "@/assets/hero.jpg";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "Our craft · Sabara" },
      { name: "description", content: "How our handwoven mats are made — fibre, dye, loom and time." },
    ],
  }),
});

const steps = [
  { n: "01", t: "Sourcing", d: "Jute, cotton and coir from farms we visit each season." },
  { n: "02", t: "Dyeing", d: "Small batches of plant-based dyes — indigo, madder, marigold, eucalyptus." },
  { n: "03", t: "Warping", d: "Threads measured and stretched onto a wooden pit loom by hand." },
  { n: "04", t: "Weaving", d: "Two to four days of slow weft work, one weaver per piece." },
  { n: "05", t: "Finishing", d: "Washed, fringed, sun-dried, folded, sent." },
];

function About() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 md:py-24">
        <ScrollReveal variant="fade-up" duration={900}>
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            Our craft
          </span>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground md:text-6xl">
            A quieter way to make a mat.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Sabara began in a small workshop with one pit loom and three weavers. Today
            there are nine of us. Everything we make is woven by hand, in natural fibres, in small
            enough batches that we still notice each piece.
          </p>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <ScrollReveal variant="zoom-out" duration={1000}>
          <div className="overflow-hidden rounded-2xl">
            <img src={hero} alt="Mat in a sunlit room" loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.5s] hover:scale-105" />
          </div>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <ScrollReveal variant="fade-right" duration={900}>
            <div className="overflow-hidden rounded-2xl">
              <img src={craft} alt="Hands weaving" loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.5s] hover:scale-105" />
            </div>
          </ScrollReveal>
          <div>
            <ScrollReveal variant="fade-left" duration={800}>
              <h2 className="font-serif text-3xl text-foreground md:text-4xl">From fibre to floor</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Every mat passes through five quiet steps. None of them is rushed. Most of them
                happen within a few kilometres of each other, in workshops we know by name.
              </p>
            </ScrollReveal>
            <ol className="mt-8 space-y-5">
              {steps.map((s, i) => (
                <ScrollReveal key={s.n} variant="fade-up" delay={i * 120} duration={600}>
                  <li className="flex gap-4 group">
                    <span className="font-serif text-xl text-primary transition-transform duration-300 group-hover:scale-110">{s.n}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground transition-colors group-hover:text-primary duration-300">{s.t}</div>
                      <div className="text-sm text-muted-foreground">{s.d}</div>
                    </div>
                  </li>
                </ScrollReveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <ScrollReveal variant="fade-up" duration={800}>
          <h2 className="font-serif text-3xl text-foreground md:text-4xl">Come find a mat.</h2>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/95 hover:scale-105 active:scale-95 shadow-sm"
          >
            Browse the collection
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
