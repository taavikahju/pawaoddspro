import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

/**
 * ProtectedRoute component for handling routes that require authentication
 */
export function ProtectedRoute({
  path,
  component: Component,
  requireAdmin = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  requireAdmin?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // If user is not logged in, redirect to auth page
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // If admin role is required but user is not an admin, redirect to dashboard
  if (requireAdmin && user.role !== "admin") {
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  // User is authenticated and has appropriate permissions
  return <Route path={path} component={Component} />;
}