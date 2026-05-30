import { A } from "@solidjs/router";
import { Card, CardContent } from "../components/ui/card";

export default function Settings() {
  return (
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold text-gray-900">Settings</h1>
      <div class="grid grid-cols-2 gap-4">
        <A href="/settings/categories" class="block">
          <Card class="hover:border-gray-300 transition-colors cursor-pointer"><CardContent class="p-4">
            <h3 class="font-medium text-gray-900">Categories</h3>
            <p class="text-sm text-gray-500 mt-1">Manage income and expense categories</p>
          </CardContent></Card>
        </A>
        <Card><CardContent class="p-4">
          <h3 class="font-medium text-gray-900">Profile</h3>
          <p class="text-sm text-gray-500 mt-1">Account settings</p>
        </CardContent></Card>
      </div>
    </div>
  );
}
