import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TournamentMargins: React.FC = () => {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Tournament Margins</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Bookmaker Tournament Margins</CardTitle>
          <CardDescription>
            Compare margins across different bookmakers and tournaments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Tournament margin data will be displayed here soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentMargins;