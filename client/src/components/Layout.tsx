import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { useThemeToggle } from '@/hooks/use-theme';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, SunIcon, MoonIcon, Menu, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function Layout({ children, title, subtitle }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toggleTheme, isDarkMode, mounted } = useThemeToggle();
  const { refreshData, isRefreshing } = useBookmakerContext();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-900">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden mr-4 text-white hover:bg-blue-700/50"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Link href="/">
                <a className="flex items-center">
                  <span className="text-2xl font-bold text-white">OddsCompare</span>
                  <span className="ml-1 text-xs bg-yellow-400 text-black px-1.5 py-0.5 rounded">BETA</span>
                </a>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Input
                  type="text"
                  placeholder="Search events..."
                  className="px-3 py-2 pr-10 block w-full bg-blue-700/30 border-blue-500/50 text-white placeholder:text-blue-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-200 hover:text-white"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refreshData()}
                disabled={isRefreshing}
                className="p-1.5 text-white hover:bg-blue-700/50 rounded-full"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              
              {/* Dark mode toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleTheme}
                className="p-1.5 text-white hover:bg-blue-700/50 rounded-full"
              >
                {isDarkMode ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          {/* Sub header with title */}
          <div className="px-4 py-2 md:px-6 bg-white/10 text-white">
            <h2 className="text-lg font-medium">{title}</h2>
            {subtitle && <p className="text-sm text-blue-100">{subtitle}</p>}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-4 md:p-6 bg-gray-50 dark:bg-slate-900 min-h-[calc(100vh-116px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
