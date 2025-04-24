import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAdminKey, setAdminKey, clearAdminKey } from '@/lib/queryClient';
import { LockIcon, UnlockIcon, KeyIcon } from 'lucide-react';

export default function AdminKeyForm() {
  const { toast } = useToast();
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'locked' | 'unlocked'>('locked');

  useEffect(() => {
    // Check if we already have an admin key stored
    const storedKey = getAdminKey();
    if (storedKey) {
      setStatus('unlocked');
      setKey(storedKey);
    }
  }, []);

  const handleSaveKey = () => {
    if (!key.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an admin key',
        variant: 'destructive',
      });
      return;
    }

    setAdminKey(key.trim());
    setStatus('unlocked');
    
    toast({
      title: 'Success',
      description: 'Admin key saved successfully',
    });
  };

  const handleClearKey = () => {
    clearAdminKey();
    setKey('');
    setStatus('locked');
    
    toast({
      title: 'Info',
      description: 'Admin key cleared',
    });
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center">
          <KeyIcon className="mr-2 h-5 w-5" />
          Admin Access
        </CardTitle>
        <CardDescription>
          Enter your admin key to enable administrative actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Input
              type="password"
              placeholder="Enter admin key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={status === 'unlocked'}
              className={status === 'unlocked' ? 'bg-green-50 dark:bg-green-900/10' : ''}
            />
            {status === 'unlocked' && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400">
                <UnlockIcon className="h-4 w-4" />
              </div>
            )}
            {status === 'locked' && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600 dark:text-red-400">
                <LockIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          {status === 'locked' ? (
            <Button onClick={handleSaveKey}>
              Save Key
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClearKey}>
              Clear Key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}