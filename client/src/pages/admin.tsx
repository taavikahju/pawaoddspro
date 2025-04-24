import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Edit, Plus, RefreshCw, Save, Trash, Upload } from 'lucide-react';
import Layout from '@/components/Layout';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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

  // Fetch bookmakers and sports
  const { data: bookmakers = [], isLoading: isLoadingBookmakers } = useQuery({
    queryKey: ['/api/bookmakers'],
  });

  const { data: sports = [], isLoading: isLoadingSports } = useQuery({
    queryKey: ['/api/sports'],
  });

  // Mutations for adding/updating/deleting bookmakers
  const addBookmakerMutation = useMutation({
    mutationFn: (bookmaker: any) => apiRequest('/api/bookmakers', 'POST', bookmaker),
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
    mutationFn: (bookmaker: any) => apiRequest(`/api/bookmakers/${bookmaker.id}`, 'PATCH', bookmaker),
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

  // Mutations for adding/updating/deleting sports
  const addSportMutation = useMutation({
    mutationFn: (sport: any) => apiRequest('/api/sports', 'POST', sport),
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
    mutationFn: (sport: any) => apiRequest(`/api/sports/${sport.id}`, 'PATCH', sport),
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
      const response = await fetch('/api/scrapers/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      return response.json();
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
    mutationFn: () => apiRequest('/api/scrapers/run', 'POST'),
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

  // Handle form submissions
  const handleAddBookmaker = (e: React.FormEvent) => {
    e.preventDefault();
    addBookmakerMutation.mutate(newBookmaker);
  };

  const handleUpdateBookmaker = (bookmaker: any) => {
    updateBookmakerMutation.mutate(bookmaker);
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

  const handleScraperUpload = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !selectedBookmakerForUpload) {
      toast({
        title: 'Error',
        description: 'Please select both a file and a bookmaker',
        variant: 'destructive',
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('bookmaker', selectedBookmakerForUpload);
    
    uploadScraperMutation.mutate(formData);
  };

  return (
    <Layout title="Admin Panel" subtitle="Manage bookmakers, sports, and scrapers">
      <div className="space-y-6">
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-2"
                            onClick={() => setEditingBookmaker(bookmaker.id)}
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
                  
                  <div className="flex justify-end">
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
      </div>
    </Layout>
  );
}