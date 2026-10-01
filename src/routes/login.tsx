import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in · Sabara" },
      { name: "description", content: "Log in or sign up to Sabara." },
    ],
  }),
});

function LoginPage() {
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
