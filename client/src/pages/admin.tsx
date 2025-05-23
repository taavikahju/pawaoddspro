import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Edit, 
  Plus, 
  RefreshCw, 
  Save, 
  Trash,
  Trash2, 
  Upload, 
  PlayCircle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import Layout from '@/components/Layout';
import AdminKeyForm from '@/components/AdminKeyForm';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('bookmakers');
  const [editingBookmaker, setEditingBookmaker] = useState<number | null>(null);
  const [editingSport, setEditingSport] = useState<number | null>(null);
  const [newBookmaker, setNewBookmaker] = useState({ name: '', code: '', active: true });
  const [newSport, setNewSport] = useState({ name: '', code: '', active: true });
  const [isAddingBookmaker, setIsAddingBookmaker] = useState(false);
  const [isAddingSport, setIsAddingSport] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBookmakerForUpload, setSelectedBookmakerForUpload] = useState('');
  const [testResults, setTestResults] = useState<any>(null);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);

  // Fetch bookmakers and sports
  const { data: bookmakers = [], isLoading: isLoadingBookmakers } = useQuery({
    queryKey: ['/api/bookmakers'],
  });

  const { data: sports = [], isLoading: isLoadingSports } = useQuery({
    queryKey: ['/api/sports'],
  });

  // Mutations for adding/updating/deleting bookmakers
  const addBookmakerMutation = useMutation({
    mutationFn: (bookmaker: any) => apiRequest('POST', '/api/bookmakers', bookmaker, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmakers'] });
      setNewBookmaker({ name: '', code: '', active: true });
      setIsAddingBookmaker(false);
      toast({
        title: 'Success',
        description: 'Bookmaker added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to add bookmaker: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const updateBookmakerMutation = useMutation({
    mutationFn: (bookmaker: any) => apiRequest('PATCH', `/api/bookmakers/${bookmaker.id}`, bookmaker, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmakers'] });
      setEditingBookmaker(null);
      toast({
        title: 'Success',
        description: 'Bookmaker updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update bookmaker: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  const deleteBookmakerMutation = useMutation({
    mutationFn: (bookmakerId: number) => apiRequest('DELETE', `/api/bookmakers/${bookmakerId}`, undefined, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmakers'] });
      toast({
        title: 'Success',
        description: 'Bookmaker deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete bookmaker: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Mutations for adding/updating/deleting sports
  const addSportMutation = useMutation({
    mutationFn: (sport: any) => apiRequest('POST', '/api/sports', sport, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sports'] });
      setNewSport({ name: '', code: '', active: true });
      setIsAddingSport(false);
      toast({
        title: 'Success',
        description: 'Sport added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to add sport: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const updateSportMutation = useMutation({
    mutationFn: (sport: any) => apiRequest('PATCH', `/api/sports/${sport.id}`, sport, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sports'] });
      setEditingSport(null);
      toast({
        title: 'Success',
        description: 'Sport updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update sport: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Mutation for file upload
  const uploadScraperMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const bookmakerCode = formData.get('bookmaker') as string;
      console.log('Uploading script for bookmaker:', bookmakerCode);
      
      if (!bookmakerCode) {
        throw new Error('Bookmaker code is required');
      }
      
      // Create a URL with query parameter as backup
      const url = `/api/scrapers/upload?bookmaker=${encodeURIComponent(bookmakerCode)}`;
      
      // Debug formData contents
      console.log('FormData contents:');
      for (const pair of formData.entries()) {
        console.log(`${pair[0]}: ${pair[1]}`);
      }
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            // Add custom header for bookmaker code to handle multer issues
            'X-Bookmaker-Code': bookmakerCode
          },
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload response error:', errorText);
          throw new Error(errorText || `HTTP error ${response.status}`);
        }
        
        return response.json();
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      setSelectedFile(null);
      setSelectedBookmakerForUpload('');
      toast({
        title: 'Success',
        description: 'Scraper script uploaded successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to upload scraper script: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Mutation for running scrapers manually
  const runScrapersMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/scrapers/run', undefined, true),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Manual scraper run initiated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to run scrapers: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation for testing a scraper
  const testScraperMutation = useMutation({
    mutationFn: async (bookmakerCode: string) => {
      console.log('Testing scraper for bookmaker:', bookmakerCode);
      
      const response = await apiRequest('POST', `/api/scrapers/test/${encodeURIComponent(bookmakerCode)}`, undefined, true);
      return response;
    },
    onSuccess: (data) => {
      setTestResults(data);
      setIsTestDialogOpen(true);
      toast({
        title: 'Success',
        description: 'Scraper test completed successfully',
      });
    },
    onError: (error: any) => {
      console.error('Test scraper mutation error:', error);
      toast({
        title: 'Error',
        description: `Failed to test scraper: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });

  // Handle form submissions
  const handleAddBookmaker = (e: React.FormEvent) => {
    e.preventDefault();
    addBookmakerMutation.mutate(newBookmaker);
  };

  const handleUpdateBookmaker = (bookmaker: any) => {
    updateBookmakerMutation.mutate(bookmaker);
  };
  
  const handleDeleteBookmaker = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      deleteBookmakerMutation.mutate(id);
    }
  };

  const handleAddSport = (e: React.FormEvent) => {
    e.preventDefault();
    addSportMutation.mutate(newSport);
  };

  const handleUpdateSport = (sport: any) => {
    updateSportMutation.mutate(sport);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleScraperUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !selectedBookmakerForUpload) {
      toast({
        title: 'Error',
        description: 'Please select both a file and a bookmaker',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create the FormData object
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Add bookmaker code in multiple ways to ensure it's received
      formData.append('bookmaker', selectedBookmakerForUpload);
      
      // Log the form data for debugging
      console.log('Uploading file:', selectedFile.name);
      console.log('For bookmaker:', selectedBookmakerForUpload);
      console.log('FormData contents logged');
      
      // Create a direct fetch instead of using the mutation
      const url = `/api/scrapers/upload?bookmaker=${encodeURIComponent(selectedBookmakerForUpload)}`;
      
      // Get admin key
      const adminKey = localStorage.getItem('adminKey');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Bookmaker-Code': selectedBookmakerForUpload,
          'X-Admin-Key': adminKey || ''
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      
      const result = await response.json();
      
      setSelectedFile(null);
      setSelectedBookmakerForUpload('');
      toast({
        title: 'Success',
        description: 'Scraper script uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading script:', error);
      toast({
        title: 'Error',
        description: `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout title="Admin Panel" subtitle="Manage bookmakers, sports, and scrapers">
      <div className="space-y-6">
        <div className="mb-6">
          <AdminKeyForm />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="bookmakers">Bookmakers</TabsTrigger>
            <TabsTrigger value="sports">Sports</TabsTrigger>
            <TabsTrigger value="scrapers">Scrapers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bookmakers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Bookmakers</h2>
              <Button 
                onClick={() => setIsAddingBookmaker(true)}
                disabled={isAddingBookmaker}
                className="flex items-center"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Bookmaker
              </Button>
            </div>
            
            {isAddingBookmaker && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Bookmaker</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddBookmaker} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input 
                          id="name" 
                          value={newBookmaker.name} 
                          onChange={(e) => setNewBookmaker({...newBookmaker, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="code">Code</Label>
                        <Input 
                          id="code" 
                          value={newBookmaker.code} 
                          onChange={(e) => setNewBookmaker({...newBookmaker, code: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="active" 
                        checked={newBookmaker.active} 
                        onCheckedChange={(checked) => setNewBookmaker({...newBookmaker, active: checked})}
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsAddingBookmaker(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {isLoadingBookmakers ? (
                <p>Loading bookmakers...</p>
              ) : (
                bookmakers.map((bookmaker: any) => (
                  <Card key={bookmaker.id} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex justify-between items-center">
                        <span>{bookmaker.name}</span>
                        {bookmaker.active ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded dark:bg-green-900 dark:text-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-300">
                            Inactive
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {editingBookmaker === bookmaker.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-name-${bookmaker.id}`}>Name</Label>
                              <Input 
                                id={`edit-name-${bookmaker.id}`} 
                                value={bookmaker.name} 
                                onChange={(e) => {
                                  const updatedBookmakers = bookmakers.map((b: any) => 
                                    b.id === bookmaker.id ? {...b, name: e.target.value} : b
                                  );
                                  queryClient.setQueryData(['/api/bookmakers'], updatedBookmakers);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-code-${bookmaker.id}`}>Code</Label>
                              <Input 
                                id={`edit-code-${bookmaker.id}`} 
                                value={bookmaker.code} 
                                onChange={(e) => {
                                  const updatedBookmakers = bookmakers.map((b: any) => 
                                    b.id === bookmaker.id ? {...b, code: e.target.value} : b
                                  );
                                  queryClient.setQueryData(['/api/bookmakers'], updatedBookmakers);
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id={`edit-active-${bookmaker.id}`} 
                              checked={bookmaker.active} 
                              onCheckedChange={(checked) => {
                                const updatedBookmakers = bookmakers.map((b: any) => 
                                  b.id === bookmaker.id ? {...b, active: checked} : b
                                );
                                queryClient.setQueryData(['/api/bookmakers'], updatedBookmakers);
                              }}
                            />
                            <Label htmlFor={`edit-active-${bookmaker.id}`}>Active</Label>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setEditingBookmaker(null)}>
                              Cancel
                            </Button>
                            <Button onClick={() => handleUpdateBookmaker(bookmaker)}>
                              <Save className="mr-1 h-4 w-4" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium">Code: </span>
                            <span className="text-sm">{bookmaker.code}</span>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 mt-2"
                              onClick={() => setEditingBookmaker(bookmaker.id)}
                            >
                              <Edit className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => handleDeleteBookmaker(bookmaker.id, bookmaker.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="sports" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Sports</h2>
              <Button 
                onClick={() => setIsAddingSport(true)}
                disabled={isAddingSport}
                className="flex items-center"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Sport
              </Button>
            </div>
            
            {isAddingSport && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Sport</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddSport} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input 
                          id="name" 
                          value={newSport.name} 
                          onChange={(e) => setNewSport({...newSport, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="code">Code</Label>
                        <Input 
                          id="code" 
                          value={newSport.code} 
                          onChange={(e) => setNewSport({...newSport, code: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="active" 
                        checked={newSport.active} 
                        onCheckedChange={(checked) => setNewSport({...newSport, active: checked})}
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsAddingSport(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {isLoadingSports ? (
                <p>Loading sports...</p>
              ) : (
                sports.map((sport: any) => (
                  <Card key={sport.id} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex justify-between items-center">
                        <span>{sport.name}</span>
                        {sport.active ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded dark:bg-green-900 dark:text-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-300">
                            Inactive
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {editingSport === sport.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-name-${sport.id}`}>Name</Label>
                              <Input 
                                id={`edit-name-${sport.id}`} 
                                value={sport.name} 
                                onChange={(e) => {
                                  const updatedSports = sports.map((s: any) => 
                                    s.id === sport.id ? {...s, name: e.target.value} : s
                                  );
                                  queryClient.setQueryData(['/api/sports'], updatedSports);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-code-${sport.id}`}>Code</Label>
                              <Input 
                                id={`edit-code-${sport.id}`} 
                                value={sport.code} 
                                onChange={(e) => {
                                  const updatedSports = sports.map((s: any) => 
                                    s.id === sport.id ? {...s, code: e.target.value} : s
                                  );
                                  queryClient.setQueryData(['/api/sports'], updatedSports);
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id={`edit-active-${sport.id}`} 
                              checked={sport.active} 
                              onCheckedChange={(checked) => {
                                const updatedSports = sports.map((s: any) => 
                                  s.id === sport.id ? {...s, active: checked} : s
                                );
                                queryClient.setQueryData(['/api/sports'], updatedSports);
                              }}
                            />
                            <Label htmlFor={`edit-active-${sport.id}`}>Active</Label>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setEditingSport(null)}>
                              Cancel
                            </Button>
                            <Button onClick={() => handleUpdateSport(sport)}>
                              <Save className="mr-1 h-4 w-4" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium">Code: </span>
                            <span className="text-sm">{sport.code}</span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-2"
                            onClick={() => setEditingSport(sport.id)}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="scrapers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Run Scrapers Manually</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Scrapers run automatically every 15 minutes. You can also trigger a manual run.
                  </p>
                  <Button
                    onClick={() => runScrapersMutation.mutate()}
                    disabled={runScrapersMutation.isPending}
                    className="flex items-center"
                  >
                    <RefreshCw className={`mr-1 h-4 w-4 ${runScrapersMutation.isPending ? 'animate-spin' : ''}`} />
                    Run Scrapers Now
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Separator />
            
            <Card>
              <CardHeader>
                <CardTitle>Upload Scraper Script</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleScraperUpload} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bookmaker">Select Bookmaker</Label>
                      <select 
                        id="bookmaker"
                        value={selectedBookmakerForUpload}
                        onChange={(e) => setSelectedBookmakerForUpload(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                      >
                        <option value="">Select a bookmaker</option>
                        {bookmakers.map((bookmaker: any) => (
                          <option key={bookmaker.id} value={bookmaker.code}>
                            {bookmaker.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="file">Scraper Script File</Label>
                      <Input 
                        id="file" 
                        type="file" 
                        onChange={handleFileChange}
                        accept=".js,.py,.sh,.ts"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Supported file types: .js, .py, .sh, .ts
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    {selectedBookmakerForUpload && (
                      <Button 
                        type="button"
                        variant="outline"
                        disabled={testScraperMutation.isPending}
                        onClick={() => testScraperMutation.mutate(selectedBookmakerForUpload)}
                        className="flex items-center"
                      >
                        <PlayCircle className="mr-1 h-4 w-4" />
                        {testScraperMutation.isPending ? 'Testing...' : 'Test Script'}
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      className="flex items-center"
                      disabled={!selectedFile || !selectedBookmakerForUpload || uploadScraperMutation.isPending}
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      Upload Script
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Test Results Dialog */}
        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-lg">
                {testResults?.success ? (
                  <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                )}
                {testResults?.success ? 'Scraper Test Successful' : 'Scraper Test Failed'}
              </DialogTitle>
              <DialogDescription>
                {testResults?.message}
              </DialogDescription>
            </DialogHeader>
            
            {testResults?.success && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Bookmaker: {testResults?.bookmaker?.name}
                  </h3>
                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-200">
                    {testResults?.count} events found
                  </span>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">
                    Sample Data (First 5 Events)
                  </div>
                  
                  <div className="p-4 space-y-4 text-sm">
                    {testResults?.events?.length > 0 ? (
                      testResults.events.map((event: any, index: number) => (
                        <div key={index} className="border-b pb-3 last:border-b-0 last:pb-0">
                          <h4 className="font-semibold">{event.teams || event.event}</h4>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="space-y-1">
                              <div><span className="font-medium">Country:</span> {event.country}</div>
                              <div><span className="font-medium">Tournament:</span> {event.tournament}</div>
                              <div><span className="font-medium">Start Time:</span> {event.start_time}</div>
                            </div>
                            <div className="space-y-1">
                              <div><span className="font-medium">ID:</span> {event.eventId}</div>
                              <div><span className="font-medium">Market:</span> {event.market}</div>
                              <div className="font-medium">Odds:</div>
                              <div className="pl-4 space-y-1">
                                {Object.entries(event.odds || {}).map(([key, value]: [string, any]) => (
                                  <div key={key} className="grid grid-cols-2">
                                    <span>{key}:</span>
                                    <span>{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>No events returned in test data</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {!testResults?.success && (
              <div className="bg-red-50 text-red-700 p-4 rounded dark:bg-red-900 dark:text-red-100">
                <p className="font-semibold">Error:</p>
                <p className="font-mono text-sm whitespace-pre-wrap break-words">
                  {testResults?.error || 'Unknown error occurred when testing scraper.'}
                </p>
              </div>
            )}
            
            <DialogFooter>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}