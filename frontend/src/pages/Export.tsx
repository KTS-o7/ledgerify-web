import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

export default function Export() {
  return (
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold text-gray-900">Export Data</h1>
      <Card><CardContent class="p-6">
        <p class="text-gray-700 mb-4">Download your transactions as a CSV file.</p>
        <Button>Download CSV</Button>
      </CardContent></Card>
    </div>
  );
}
