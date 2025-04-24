import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import LogoutButton from "./LogoutButton";
import { Button } from "@/components/ui/button";
import { UserCircle, Settings, ChevronDown, BarChart2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path ? "bg-accent text-accent-foreground" : "";
  };

  const renderNavLinks = () => {
    return (
      <div className="hidden md:flex items-center space-x-4">
        <Link href="/">
          <Button variant="ghost" className={`${isActive("/")}`}>
            Dashboard
          </Button>
        </Link>
        <Link href="/scraper-status">
          <Button variant="ghost" className={`${isActive("/scraper-status")}`}>
            Scraper Status
          </Button>
        </Link>
        {user?.role === "admin" && (
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
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <UserCircle className="h-5 w-5" />
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.username}</span>
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <BarChart2 className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Admin Settings</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {}}
                  className="cursor-pointer"
                >
                  <LogoutButton variant="ghost" className="w-full justify-start p-0 font-normal" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button variant="default" size="sm">
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}