import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

export default function Import() {
  return (
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold text-gray-900">Import Transactions</h1>
      <Card>
        <CardContent class="p-6 flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-gray-300 rounded-xl">
          <p class="text-gray-500 mb-4">Drop a CSV file here or click to browse</p>
          <Button>Choose File</Button>
        </CardContent>
      </Card>
    </div>
  );
}
