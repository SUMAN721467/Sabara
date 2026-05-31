import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/test-email")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ success: true, message: "Cleaned up" });
      }
    }
  }
});
