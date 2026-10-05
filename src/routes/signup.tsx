import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

import { buildPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: SignupPage,
  head: () => buildPageMeta({
    title: "Sign up | Sabara",
    description: "Sign up to Sabara.",
    path: "/signup",
    noindex: true
  }),
});

function SignupPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { openLoginModal } = useAuth();

  useEffect(() => {
    openLoginModal();
    void navigate({
      to: redirect || "/",
      replace: true,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
