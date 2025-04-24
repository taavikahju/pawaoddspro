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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refreshData()}
                disabled={isRefreshing}
                className="p-1.5 text-white hover:bg-blue-700/50 rounded-full"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
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
