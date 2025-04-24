import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useThemeToggle } from '@/hooks/use-theme';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function Layout({ children, title, subtitle }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const { mounted } = useThemeToggle();
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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navbar */}
      <Navbar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left hover zone */}
        <div 
          className="fixed top-14 left-0 w-4 h-[calc(100%-3.5rem)] z-20"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Sidebar */}
        <div 
          onMouseEnter={handleMouseEnter} 
          onMouseLeave={handleMouseLeave}
          className="h-[calc(100vh-3.5rem)]"
        >
          <Sidebar 
            isOpen={sidebarOpen}
            isHovering={isHoveringSidebar}
            onClose={() => setSidebarOpen(false)} 
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Mobile menu button */}
          <div className="lg:hidden p-2 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Main Content Area */}
          <main className="p-3 md:p-4 bg-gray-50 dark:bg-slate-900 min-h-[calc(100vh-3.5rem)]">
            {title && (
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
