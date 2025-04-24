import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAdminKey } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function LogoutButton({ 
  variant = "default", 
  className = ""
}: { 
  variant?: "default" | "outline" | "ghost"; 
  className?: string;
}) {
  const { toast } = useToast();
  
  const handleLogout = () => {
    clearAdminKey();
    
    toast({
      title: "Logged out",
      description: "Admin key has been cleared successfully",
    });
    
    // Refresh the page to update UI state
    window.location.href = "/";
  };
  
  return (
    <Button 
      variant={variant} 
      className={className}
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Clear Admin Access
    </Button>
  );
}