import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Settings, BarChart2, History } from "lucide-react";
import { getAdminKey } from "@/lib/queryClient";

export default function Navbar() {
  const [location] = useLocation();
  
  const isActive = (path: string) => {
    return location === path ? "bg-accent text-accent-foreground" : "";
  };

  // Check if admin key exists
  const hasAdminKey = !!getAdminKey();

  const renderNavLinks = () => {
    return (
      <div className="hidden md:flex items-center space-x-4">
        <Link href="/">
          <Button variant="ghost" className={`${isActive("/")}`}>
            Dashboard
          </Button>
        </Link>
        <Link href="/historical-odds">
          <Button variant="ghost" className={`${isActive("/historical-odds")}`}>
            Historical Odds
          </Button>
        </Link>
        <Link href="/scraper-status">
          <Button variant="ghost" className={`${isActive("/scraper-status")}`}>
            Scraper Status
          </Button>
        </Link>
        {hasAdminKey && (
          <Link href="/admin">
            <Button variant="ghost" className={`${isActive("/admin")}`}>
              Admin
            </Button>
          </Link>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">
              <span className="text-gray-900 dark:text-white">pawa</span>
              <span className="text-[#00BCFF]">odds</span>
              <span className="text-gray-900 dark:text-white">.pro</span>
            </span>
          </Link>
        </div>
        
        {renderNavLinks()}
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Link href="/historical-odds">
            <Button variant="ghost" size="sm" className="flex md:hidden items-center gap-1">
              <History className="h-4 w-4" />
              <span className="sr-only md:not-sr-only">Historical</span>
            </Button>
          </Link>
          {hasAdminKey && (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span>Admin</span>
              </Button>
            </Link>
          )}
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-1">
              <BarChart2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}