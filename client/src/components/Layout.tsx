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
  title?: string;
  subtitle?: string;
}

export default function Layout({ children, title, subtitle }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toggleTheme, isDarkMode, mounted } = useThemeToggle();
  const { refreshData, isRefreshing } = useBookmakerContext();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  // Handle mouse hover for sidebar
  const handleMouseEnter = () => {
    setIsHoveringSidebar(true);
  };
  
  const handleMouseLeave = () => {
    setIsHoveringSidebar(false);
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left hover zone */}
      <div 
        className="fixed top-0 left-0 w-4 h-full z-20"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Sidebar */}
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <Sidebar 
          isOpen={sidebarOpen}
          isHovering={isHoveringSidebar}
          onClose={() => setSidebarOpen(false)} 
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Header - Minimal */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden mr-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Link href="/">
                <a className="flex items-center">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">OddsCompare</span>
                  <span className="ml-1 text-[10px] bg-yellow-400 text-black px-1 py-0.5 rounded">BETA</span>
                </a>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-3 md:p-4 bg-gray-50 dark:bg-slate-900 min-h-[calc(100vh-36px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
